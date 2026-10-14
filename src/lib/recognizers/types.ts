import type { Detection } from "../../types";

export type RecognizerId = "coco" | "zeroshot" | "llm";

export type Recognition = {
  /** objects.json의 사물 ID (COCO 클래스명이 아니라 사물 ID로 통일) */
  objectId: string;
  score: number;
  /** 위치를 주는 엔진만 */
  box?: Detection["box"];
  by: RecognizerId;
};

export type RecognizeOutput = { recognitions: Recognition[]; ms: number; raw?: unknown };

export interface Recognizer {
  id: RecognizerId;
  stage: 1 | 2 | 3;
  /** 이 빌드에서 켜져 있는가 (config의 RECOGNIZERS) */
  enabled: boolean;
  isReady(): boolean;
  load(): Promise<void>;
  recognize(image: HTMLCanvasElement): Promise<RecognizeOutput>;
}

/** 준비 중인 단계의 엔진을 호출했을 때 */
export class NotAvailableError extends Error {
  constructor(id: RecognizerId) {
    super(`${id} recognizer is not available in this build`);
    this.name = "NotAvailableError";
  }
}
