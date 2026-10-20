import { describe, expect, it, vi } from "vitest";
import { createPipeline } from "./pipeline";
import { llmRecognizer } from "./llm";
import { zeroshotRecognizer } from "./zeroshot";
import type { Recognition, Recognizer, RecognizerId } from "./types";

const image = {} as HTMLCanvasElement;
const hit = (objectId: string, by: RecognizerId): Recognition => ({ objectId, score: 0.9, by });

function fake(id: RecognizerId, stage: 1 | 2 | 3, enabled: boolean, found: Recognition[]): Recognizer {
  return {
    id,
    stage,
    enabled,
    isReady: () => true,
    load: vi.fn(async () => {}),
    recognize: vi.fn(async () => ({ recognitions: found, ms: 10, raw: id })),
  };
}

describe("pipeline", () => {
  it("꺼진 단계는 요청해도 돌리지 않는다 (3단계 스텁 포함)", async () => {
    const llm = vi.spyOn(llmRecognizer, "recognize");
    const coco = fake("coco", 1, true, []);
    const zs = fake("zeroshot", 2, false, [hit("led_bulb", "zeroshot")]);
    const out = await createPipeline([llmRecognizer, coco, zs]).run(image, ["zeroshot", "llm"]);
    expect(out.ran).toEqual(["coco"]);
    expect(out.recognitions).toEqual([]);
    expect(zs.recognize).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    expect(llmRecognizer.enabled).toBe(false);
    expect(zeroshotRecognizer.enabled).toBe(true);
  });

  it("2단계는 요청하면 1단계가 찾았어도 돌린다", async () => {
    const coco = fake("coco", 1, true, [hit("person", "coco")]);
    const zs = fake("zeroshot", 2, true, [hit("smartwatch", "zeroshot")]);
    const pipe = createPipeline([coco, zs]);

    // 2차 도감이 열리기 전(요청 없음)에는 1단계만
    expect((await pipe.run(image)).ran).toEqual(["coco"]);
    expect(zs.recognize).not.toHaveBeenCalled();

    const out = await pipe.run(image, ["zeroshot"]);
    expect(out.ran).toEqual(["coco", "zeroshot"]);
    expect(out.recognitions.map((r) => r.objectId)).toEqual(["person", "smartwatch"]);
  });

  it("1단계가 0개이고 요청한 경우에만 상위 단계를 시도한다", async () => {
    const coco = fake("coco", 1, true, []);
    const zs = fake("zeroshot", 2, true, [hit("led_bulb", "zeroshot")]);
    const llm = fake("llm", 3, true, [hit("mri", "llm")]);
    const pipe = createPipeline([coco, zs, llm]);

    expect((await pipe.run(image)).ran).toEqual(["coco"]);
    const out = await pipe.run(image, ["zeroshot", "llm"]);
    expect(out.ran).toEqual(["coco", "zeroshot"]);
    expect(out.recognitions.map((r) => r.objectId)).toEqual(["led_bulb"]);
    expect(out.ms).toBe(20);
  });

  it("상위 단계가 실패하면 기록만 하고, 모델을 받기 전에 onLoad를 부른다", async () => {
    const coco = fake("coco", 1, true, []);
    const zs = fake("zeroshot", 2, true, []);
    zs.isReady = () => false;
    zs.load = vi.fn(async () => {
      throw new Error("offline");
    });
    const onLoad = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await createPipeline([coco, zs]).run(image, ["zeroshot"], { onLoad });
    expect(onLoad).toHaveBeenCalledWith("zeroshot");
    expect(out.ran).toEqual(["coco"]);
    expect(out.failed).toEqual(["zeroshot"]);
    warn.mockRestore();
  });

  it("1단계가 실패하면 그대로 던진다", async () => {
    const coco = fake("coco", 1, true, []);
    coco.recognize = vi.fn(async () => {
      throw new Error("model");
    });
    await expect(createPipeline([coco]).run(image)).rejects.toThrow("model");
  });
});
