import type { ObjectEntry } from "../../types";

/** 텍스트 인코더에 넣는 문장 하나. objectId가 null이면 "해당 없음" 라벨 */
export type Prompt = { text: string; label: string; objectId: string | null };

export function buildPrompts(objects: ObjectEntry[], negativeLabels: readonly string[], template: string): Prompt[] {
  const fill = (label: string) => template.replace("{}", label);
  return [
    ...objects.flatMap((o) => (o.zeroshotLabelsEn ?? []).map((label) => ({ text: fill(label), label, objectId: o.id }))),
    ...negativeLabels.map((label) => ({ text: fill(label), label, objectId: null })),
  ];
}

export type PromptScore = { label: string; objectId: string | null; prob: number };
export type ObjectScore = { objectId: string | null; prob: number };
export type ZeroshotScores = {
  /** 문장별 확률 (높은 순) */
  prompts: PromptScore[];
  /** 사물별 확률 = 그 사물 문장들의 확률 합 (높은 순). null은 "해당 없음" 라벨 합 */
  objects: ObjectScore[];
};

const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);

/**
 * 정규화된 이미지 임베딩과 문장 임베딩들의 코사인 유사도에 logitScale을 곱해 softmax한다 (CLIP 방식).
 */
export function scoreImage(imageEmbed: number[], textEmbeds: number[][], prompts: Prompt[], logitScale = 100): ZeroshotScores {
  const logits = textEmbeds.map((t) => logitScale * dot(imageEmbed, t));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const scored = prompts.map((p, i) => ({ label: p.label, objectId: p.objectId, prob: exps[i] / total }));

  const byObject = new Map<string | null, number>();
  for (const s of scored) byObject.set(s.objectId, (byObject.get(s.objectId) ?? 0) + s.prob);
  return {
    prompts: scored.sort((a, b) => b.prob - a.prob),
    objects: [...byObject.entries()].map(([objectId, prob]) => ({ objectId, prob })).sort((a, b) => b.prob - a.prob),
  };
}

/** 가장 높은 사물이 "해당 없음"이 아니고 임계값을 넘으면 그 사물을 고른다. 사진 전체 분류라 하나만 고른다 */
export function pickObject(scores: ZeroshotScores, threshold: number): ObjectScore | undefined {
  const top = scores.objects[0];
  return top && top.objectId !== null && top.prob >= threshold ? top : undefined;
}
