import type { ObjectDetector } from "@mediapipe/tasks-vision";
import { DEBUG, DEBUG_MIN_SCORE, DETECTOR, RECOGNIZERS, SCORE_THRESHOLD } from "../../config";
import { COCO_ALLOWLIST, OBJECTS } from "../../data";
import type { Detection } from "../../types";
import type { Recognition, Recognizer } from "./types";

let detectorPromise: Promise<ObjectDetector> | null = null;
let ready = false;

/**
 * MediaPipe Object Detector를 지연 로드한다. 첫 사진을 올렸거나 예시를 눌렀을 때만 호출된다.
 * 모델·wasm은 같은 출처(public/models, public/wasm)에서 받는다. 실패하면 다음 호출에서 다시 시도한다.
 */
function loadDetector(): Promise<ObjectDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(DETECTOR.wasmPath);
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: DETECTOR.modelPath, delegate: "CPU" },
        runningMode: "IMAGE",
        // 디버그 모드에서는 낮은 점수·허용 목록 밖 클래스까지 받아 점수표로 보여준다
        scoreThreshold: DEBUG ? Math.min(DEBUG_MIN_SCORE, SCORE_THRESHOLD) : SCORE_THRESHOLD,
        maxResults: DEBUG ? 25 : DETECTOR.maxResults,
        ...(DEBUG ? {} : { categoryAllowlist: COCO_ALLOWLIST }),
      });
      ready = true;
      return detector;
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/** 추론 1회. detect()는 동기라 호출 전에 화면을 먼저 그려 둬야 한다. 좌표는 0~1로 정규화한다. */
async function detect(image: HTMLCanvasElement): Promise<{ detections: Detection[]; ms: number }> {
  const detector = await loadDetector();
  const start = performance.now();
  const result = detector.detect(image);
  const ms = performance.now() - start;
  const detections: Detection[] = [];
  for (const d of result.detections) {
    const category = d.categories[0];
    if (!category?.categoryName || !d.boundingBox) continue;
    const { originX, originY, width, height } = d.boundingBox;
    detections.push({
      cocoClass: category.categoryName,
      score: category.score,
      box: {
        x: originX / image.width,
        y: originY / image.height,
        width: width / image.width,
        height: height / image.height,
      },
    });
  }
  return { detections, ms };
}

/** 결과에 쓰는 인식. 디버그 모드에서는 모델이 임계값 아래·허용 목록 밖 결과까지 주므로 여기서 거른다 */
export function usableDetections(raw: Detection[]): Detection[] {
  return raw.filter((d) => d.score >= SCORE_THRESHOLD && COCO_ALLOWLIST.includes(d.cocoClass));
}

const OBJECT_ID_BY_CLASS = new Map(OBJECTS.flatMap((o) => (o.cocoClass ? [[o.cocoClass, o.id] as const] : [])));

/** 1단계: MediaPipe EfficientDet-Lite0 (COCO). raw는 ?debug 점수표용 원본 Detection[] */
export const cocoRecognizer: Recognizer = {
  id: "coco",
  stage: 1,
  enabled: RECOGNIZERS.coco,
  isReady: () => ready,
  load: async () => {
    await loadDetector();
  },
  async recognize(image) {
    const { detections, ms } = await detect(image);
    const recognitions: Recognition[] = usableDetections(detections).map((d) => ({
      objectId: OBJECT_ID_BY_CLASS.get(d.cocoClass)!,
      score: d.score,
      box: d.box,
      by: "coco",
    }));
    return { recognitions, ms, raw: detections };
  },
};
