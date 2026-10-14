import { RECOGNIZERS } from "../../config";
import { NotAvailableError, type Recognizer } from "./types";

/**
 * 2단계: 기기 안 제로샷 이미지 분류 (준비 중, v1.1 명세 5.2).
 * 후보는 Transformers.js + Xenova/mobileclip_s0. 사물의 zeroshotLabelsEn과 사진을 비교하는 방식을 상정한다.
 */
export const zeroshotRecognizer: Recognizer = {
  id: "zeroshot",
  stage: 2,
  enabled: RECOGNIZERS.zeroshot,
  isReady: () => false,
  load: async () => {
    throw new NotAvailableError("zeroshot");
  },
  recognize: async () => {
    throw new NotAvailableError("zeroshot");
  },
};
