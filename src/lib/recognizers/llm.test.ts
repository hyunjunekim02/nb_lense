import { describe, expect, it } from "vitest";
import { OBJECTS } from "../../data";
import { buildCandidates, llmRecognizer, toRecognitions } from "./llm";

describe("3단계 LLM 인식기", () => {
  const candidates = buildCandidates(OBJECTS);

  it("노벨상이 연결된 사물을 영어 라벨과 한국어 이름으로 보낸다", () => {
    expect(candidates.length).toBe(OBJECTS.filter((o) => o.prizes.length > 0).length);
    const phone = candidates.find((c) => c.id === "phone");
    expect(phone?.name).toBe("cell phone (스마트폰)");
    for (const c of candidates) expect(c.id).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
  });

  it("임계값보다 낮거나 후보 밖이면 버린다", () => {
    const base = { provider: "postech", model: "gpt-5.2", threshold: 0.6 };
    const id = candidates[0].id;
    expect(toRecognitions({ ...base, objectId: id, confidence: 0.8 }, candidates)).toEqual([{ objectId: id, score: 0.8, by: "llm" }]);
    expect(toRecognitions({ ...base, objectId: id, confidence: 0.5 }, candidates)).toEqual([]);
    expect(toRecognitions({ ...base, objectId: "unicorn", confidence: 0.9 }, candidates)).toEqual([]);
    expect(toRecognitions({ ...base, objectId: null, confidence: 0 }, candidates)).toEqual([]);
  });

  it("아직 꺼져 있다", () => {
    expect(llmRecognizer.enabled).toBe(false);
  });
});
