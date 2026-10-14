import { describe, expect, it } from "vitest";
import type { ObjectEntry } from "../../types";
import { buildPrompts, pickObject, scoreImage } from "./zeroshotScore";

const obj = (id: string, labels: string[]): ObjectEntry => ({ id, nameKo: id, icon: "", zeroshotLabelsEn: labels, prizes: [] });

describe("zeroshotScore", () => {
  const prompts = buildPrompts([obj("mosquito", ["a mosquito", "a mosquito on skin"]), obj("pencil", ["a pencil"])], ["a room"], "a photo of {}");

  it("사물 라벨과 해당 없음 라벨로 문장을 만든다", () => {
    expect(prompts.map((p) => [p.text, p.objectId])).toEqual([
      ["a photo of a mosquito", "mosquito"],
      ["a photo of a mosquito on skin", "mosquito"],
      ["a photo of a pencil", "pencil"],
      ["a photo of a room", null],
    ]);
  });

  // 문장 임베딩을 축 하나씩으로 두면 이미지 임베딩 성분이 곧 유사도다
  const text = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  it("사물별 확률은 그 사물 문장들의 합이다", () => {
    const s = scoreImage([0.1, 0.1, 0, 0], text, prompts, 10);
    expect(s.objects[0].objectId).toBe("mosquito");
    expect(s.objects[0].prob).toBeCloseTo((2 * Math.E) / (2 * Math.E + 2), 5);
    expect(s.prompts.reduce((a, p) => a + p.prob, 0)).toBeCloseTo(1, 5);
  });

  it("1위가 해당 없음이거나 임계값 아래면 고르지 않는다", () => {
    expect(pickObject(scoreImage([0, 0, 0.3, 0], text, prompts, 10), 0.5)?.objectId).toBe("pencil");
    expect(pickObject(scoreImage([0, 0, 0.3, 0], text, prompts, 10), 0.99)).toBeUndefined();
    expect(pickObject(scoreImage([0, 0, 0, 0.5], text, prompts, 10), 0.1)).toBeUndefined();
  });
});
