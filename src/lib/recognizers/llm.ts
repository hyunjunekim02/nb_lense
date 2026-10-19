import { LLM, RECOGNIZERS } from "../../config";
import { OBJECTS } from "../../data";
import type { ObjectEntry } from "../../types";
import { NotAvailableError, type Recognition, type Recognizer } from "./types";

/** 프록시 /v1/recognize 요청·응답 (proxy/src/recognize.ts와 같은 모양) */
export type LlmCandidate = { id: string; name: string };
export type LlmRaw = { objectId: string | null; confidence: number; provider: string; model: string; threshold: number };

/**
 * LLM에게 보여 줄 후보 사물. 노벨상이 연결된 사물 전부를 영어 라벨(+한국어 이름)로 보낸다.
 * 3단계는 1·2단계가 아무것도 못 찾았을 때만 돌지만, 그 단계들이 놓친 사물도 고를 수 있게 전부 넣는다.
 */
export function buildCandidates(objects: ObjectEntry[]): LlmCandidate[] {
  return objects
    .filter((o) => o.prizes.length > 0)
    .map((o) => {
      const en = o.zeroshotLabelsEn?.[0] ?? o.cocoClass;
      return { id: o.id, name: en ? `${en} (${o.nameKo})` : o.nameKo };
    });
}

/** 프록시 응답을 인식 결과로 바꾼다. 후보 밖이거나 확신이 임계값보다 낮으면 빈 결과 */
export function toRecognitions(raw: LlmRaw, candidates: LlmCandidate[]): Recognition[] {
  if (!raw.objectId || raw.confidence < raw.threshold || !candidates.some((c) => c.id === raw.objectId)) return [];
  return [{ objectId: raw.objectId, score: raw.confidence, by: "llm" }];
}

function toDataUrl(image: HTMLCanvasElement): string {
  const scale = Math.min(1, LLM.maxImageSide / Math.max(image.width, image.height));
  let canvas = image;
  if (scale < 1) {
    canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/jpeg", LLM.jpegQuality);
}

const candidates = buildCandidates(OBJECTS);

/**
 * 3단계: 서버 비전 LLM (v1.1 명세 5.3). 아직 화면 흐름에는 붙이지 않았다 (RECOGNIZERS.llm = false).
 * 이 단계에서만 사진이 서버로 가므로 켜기 전에 사용 직전 동의를 받는 화면이 필요하다.
 * LLM은 사물 ID 목록 중에서만 고르고 문구는 만들지 않는다.
 */
export const llmRecognizer: Recognizer = {
  id: "llm",
  stage: 3,
  enabled: RECOGNIZERS.llm && LLM.endpoint !== "",
  isReady: () => true,
  load: async () => {
    if (!LLM.endpoint) throw new NotAvailableError("llm");
  },
  async recognize(image) {
    if (!LLM.endpoint) throw new NotAvailableError("llm");
    const start = performance.now();
    const res = await fetch(`${LLM.endpoint}/v1/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: toDataUrl(image), candidates }),
      signal: AbortSignal.timeout(LLM.timeoutMs),
    });
    if (!res.ok) throw new Error(`llm proxy ${res.status}`);
    const raw: LlmRaw = { ...((await res.json()) as Omit<LlmRaw, "threshold">), threshold: LLM.threshold };
    return { recognitions: toRecognitions(raw, candidates), ms: performance.now() - start, raw };
  },
};
