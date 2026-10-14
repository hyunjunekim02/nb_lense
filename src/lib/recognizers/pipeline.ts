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
};

/**
 * 켜진 엔진을 단계 순서대로 돌린다 (v1.1 명세 5.1).
 * - 1단계는 항상 돌린다. 무언가 찾았으면 거기서 멈춘다.
 * - 상위 단계는 하위 단계가 0개를 찾았고, 엔진이 켜져 있고, 사용자가 그 단계를 요청했을 때만 시도한다.
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
    async run(image: HTMLCanvasElement, requested: RecognizerId[] = []): Promise<PipelineOutput> {
      const out: PipelineOutput = { recognitions: [], ms: 0, raw: {}, ran: [] };
      for (const r of ordered) {
        if (!r.enabled) continue;
        if (r.stage > 1 && (out.recognitions.length > 0 || !requested.includes(r.id))) continue;
        await r.load();
        const res = await r.recognize(image);
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
