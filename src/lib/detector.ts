import type { ObjectDetector } from "@mediapipe/tasks-vision";
import { DEBUG, DEBUG_MIN_SCORE, DETECTOR, SCORE_THRESHOLD } from "../config";
import { COCO_ALLOWLIST } from "../data";
import type { Detection } from "../types";

let detectorPromise: Promise<ObjectDetector> | null = null;
let ready = false;

export function isDetectorReady(): boolean {
  return ready;
}

/**
 * MediaPipe Object Detector를 지연 로드한다. 첫 사진을 올렸거나 예시를 눌렀을 때만 호출된다.
 * 모델·wasm은 같은 출처(public/models, public/wasm)에서 받는다. 실패하면 다음 호출에서 다시 시도한다.
 */
export function loadDetector(): Promise<ObjectDetector> {
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
export async function detect(image: HTMLCanvasElement): Promise<{ detections: Detection[]; ms: number }> {
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
