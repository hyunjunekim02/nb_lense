import { RECOGNIZERS } from "../../config";
import { NotAvailableError, type Recognizer } from "./types";

/**
 * 3단계: 서버 비전 LLM (준비 중, v1.1 명세 5.3).
 * 이 단계에서만 사진이 서버로 가므로 사용 직전에 동의를 받는다. LLM은 사물 ID 목록 중에서만 고르고 문구는 만들지 않는다.
 */
export const llmRecognizer: Recognizer = {
  id: "llm",
  stage: 3,
  enabled: RECOGNIZERS.llm,
  isReady: () => false,
  load: async () => {
    throw new NotAvailableError("llm");
  },
  recognize: async () => {
    throw new NotAvailableError("llm");
  },
};
