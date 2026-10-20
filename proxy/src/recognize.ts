// /v1/recognize: 사진 한 장에서 후보 사물 중 하나를 고르게 한다 (3단계 인식, v1.1 명세 5.3).
// LLM은 후보 ID 가운데서만 고르고 설명 문구는 만들지 않는다. 문구는 앱의 정적 데이터를 쓴다.
import { HttpError } from "./errors";

export type Candidate = { id: string; name: string };

export type RecognizeRequest = {
  /** data:image/jpeg;base64,... (앱이 긴 변 768px 정도로 줄여 보낸다) */
  image: string;
  candidates: Candidate[];
};

export type RecognizeResponse = {
  /** 후보에 없거나 확신이 없으면 null */
  objectId: string | null;
  confidence: number;
  provider: string;
  model: string;
};

export const LIMITS = {
  /** data URL 길이 (base64라 실제 이미지는 약 3/4) */
  imageChars: 2_000_000,
  candidates: 200,
  nameChars: 80,
} as const;

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** 요청 본문 검사. 문제가 있으면 400 HttpError */
export function parseRecognizeRequest(body: unknown): RecognizeRequest {
  const fail = (msg: string) => new HttpError(400, msg);
  if (!body || typeof body !== "object") throw fail("body must be a JSON object");
  const { image, candidates } = body as Record<string, unknown>;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
    throw fail("image must be a jpeg/png/webp base64 data URL");
  }
  if (image.length > LIMITS.imageChars) throw fail("image is too large");
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > LIMITS.candidates) {
    throw fail(`candidates must be 1..${LIMITS.candidates} items`);
  }
  const seen = new Set<string>();
  const list = candidates.map((c) => {
    const { id, name } = (c ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !ID_RE.test(id) || seen.has(id)) throw fail(`bad candidate id: ${String(id)}`);
    if (typeof name !== "string" || !name.trim() || name.length > LIMITS.nameChars) throw fail(`bad candidate name: ${id}`);
    seen.add(id);
    return { id, name: name.trim() };
  });
  return { image, candidates: list };
}

export const SYSTEM_PROMPT = [
  "You identify everyday objects in photos for an educational museum game.",
  "Pick the single candidate that is clearly visible and is the main subject of the photo.",
  "If none of the candidates is clearly visible, answer null. Do not guess from context alone.",
  'Reply with JSON only, no prose: {"objectId": "<candidate id>" | null, "confidence": <number 0..1>}',
].join("\n");

export function buildUserText(candidates: Candidate[]): string {
  return `Candidates (id: name):\n${candidates.map((c) => `${c.id}: ${c.name}`).join("\n")}`;
}

/** LLM 답에서 JSON을 찾아 후보 ID로 검증한다. 형식이 틀리거나 후보 밖이면 objectId null */
export function parseAnswer(text: string, candidates: Candidate[]): { objectId: string | null; confidence: number } {
  const none = { objectId: null, confidence: 0 };
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return none;
  let json: unknown;
  try {
    json = JSON.parse(match[0]);
  } catch {
    return none;
  }
  const { objectId, confidence } = (json ?? {}) as Record<string, unknown>;
  if (typeof objectId !== "string" || !candidates.some((c) => c.id === objectId)) return none;
  const conf = typeof confidence === "number" && Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  return { objectId, confidence: conf };
}
