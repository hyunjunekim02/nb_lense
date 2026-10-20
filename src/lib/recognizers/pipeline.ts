import { cocoRecognizer } from "./coco";
import { llmRecognizer } from "./llm";
import type { Recognition, Recognizer, RecognizerId } from "./types";
import { zeroshotRecognizer } from "./zeroshot";

export type PipelineOutput = {
  recognitions: Recognition[];
  /** 실제로 돌린 엔진들의 추론 시간 합 */
  ms: number;
  /** 돌린 엔진별 원본 출력 (?debug 점수표용) */
  raw: Partial<Record<RecognizerId, unknown>>;
  ran: RecognizerId[];
  /** 상위 단계가 실패했을 때 (모델을 못 받는 등). 하위 단계 결과는 그대로 쓴다 */
  failed: RecognizerId[];
};

export type RunOptions = {
  /** 아직 준비되지 않은 엔진의 모델을 받기 직전에 불린다 (분석 중 화면 안내용) */
  onLoad?: (id: RecognizerId) => void;
};

/**
 * 켜진 엔진을 단계 순서대로 돌린다 (v1.1 명세 5.1).
 * - 1단계는 항상 돌린다. 무언가 찾았으면 거기서 멈춘다.
 * - 상위 단계는 하위 단계가 0개를 찾았고, 엔진이 켜져 있고, 그 단계를 요청했을 때만 시도한다.
 * - 단, 2단계(제로샷)는 요청했으면 1단계 결과와 상관없이 돌린다. 2차 도감 사물은 손목·책상처럼
 *   1단계 사물과 함께 찍히기 쉬워서, 1단계가 무언가 찾았다고 건너뛰면 2차 칸을 열 수 없다.
 * - 1단계 실패는 그대로 던지고(오류 화면), 상위 단계 실패는 기록만 하고 넘어간다.
 */
export function createPipeline(recognizers: Recognizer[]) {
  const ordered = [...recognizers].sort((a, b) => a.stage - b.stage);
  const first = ordered.find((r) => r.enabled && r.stage === 1);

  return {
    /** 첫 사진 전에 1단계 모델이 준비됐는지 (분석 중 화면의 "처음 한 번만" 안내용) */
    isReady: () => first?.isReady() ?? true,
    load: async () => {
      await first?.load();
    },
    async run(image: HTMLCanvasElement, requested: RecognizerId[] = [], options: RunOptions = {}): Promise<PipelineOutput> {
      const out: PipelineOutput = { recognitions: [], ms: 0, raw: {}, ran: [], failed: [] };
      for (const r of ordered) {
        if (!r.enabled) continue;
        if (r.stage > 1 && ((r.stage !== 2 && out.recognitions.length > 0) || !requested.includes(r.id))) continue;
        let res;
        try {
          if (!r.isReady()) options.onLoad?.(r.id);
          await r.load();
          res = await r.recognize(image);
        } catch (err) {
          if (r.stage === 1) throw err;
          console.warn(err);
          out.failed.push(r.id);
          continue;
        }
        out.recognitions.push(...res.recognitions);
        out.ms += res.ms;
        out.raw[r.id] = res.raw;
        out.ran.push(r.id);
      }
      return out;
    },
  };
}

export const pipeline = createPipeline([cocoRecognizer, zeroshotRecognizer, llmRecognizer]);
