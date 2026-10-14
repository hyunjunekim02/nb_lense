import type { CLIPVisionModelWithProjection, Processor } from "@huggingface/transformers";
import { RECOGNIZERS, ZEROSHOT, ZEROSHOT_THRESHOLD } from "../../config";
import { ZEROSHOT_OBJECTS } from "../../data";
import type { Recognizer } from "./types";
import { buildPrompts, pickObject, scoreImage, type ZeroshotScores } from "./zeroshotScore";

export type ZeroshotRaw = ZeroshotScores & { threshold: number };

type Model = {
  processor: Processor;
  vision: CLIPVisionModelWithProjection;
  textEmbeds: number[][];
};

const prompts = buildPrompts(ZEROSHOT_OBJECTS, ZEROSHOT.negativeLabelsEn, ZEROSHOT.promptTemplate);
let modelPromise: Promise<Model> | null = null;
let ready = false;

/**
 * MobileCLIP을 지연 로드한다. 라벨 문장은 고정이라 로드할 때 한 번만 임베딩하고 텍스트 모델은 바로 내려놓는다.
 * 모델 카드 안내대로 이미지 모델은 fp32(양자화하면 정확도가 크게 떨어짐), 텍스트 모델은 q8을 쓴다.
 * 실패하면 다음 호출에서 다시 시도한다.
 */
function loadModel(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const t = await import("@huggingface/transformers");
      t.env.allowLocalModels = false;
      const [tokenizer, text, processor, vision] = await Promise.all([
        t.AutoTokenizer.from_pretrained(ZEROSHOT.modelId),
        t.CLIPTextModelWithProjection.from_pretrained(ZEROSHOT.modelId, { dtype: "q8" }),
        t.AutoProcessor.from_pretrained(ZEROSHOT.modelId),
        t.CLIPVisionModelWithProjection.from_pretrained(ZEROSHOT.modelId, { dtype: "fp32" }),
      ]);
      const inputs = tokenizer(
        prompts.map((p) => p.text),
        { padding: "max_length", truncation: true },
      );
      const { text_embeds } = await text(inputs);
      const textEmbeds = text_embeds.normalize(2, -1).tolist() as number[][];
      await text.dispose();
      ready = true;
      return { processor, vision: vision as CLIPVisionModelWithProjection, textEmbeds };
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

/**
 * 2단계: 기기 안 제로샷 이미지 분류 (v1.1 명세 5.2). Transformers.js + Xenova/mobileclip_s0.
 * 사진 전체를 사물 라벨 문장들과 비교하므로 위치(box)는 없고, 한 장에 사물 하나만 고른다.
 * raw는 ?debug 점수표용 문장별·사물별 확률.
 */
export const zeroshotRecognizer: Recognizer = {
  id: "zeroshot",
  stage: 2,
  enabled: RECOGNIZERS.zeroshot && ZEROSHOT_OBJECTS.length > 0,
  isReady: () => ready,
  load: async () => {
    await loadModel();
  },
  async recognize(image) {
    const { processor, vision, textEmbeds } = await loadModel();
    const { RawImage } = await import("@huggingface/transformers");
    const start = performance.now();
    const inputs = await processor(RawImage.fromCanvas(image));
    const { image_embeds } = await vision(inputs);
    const imageEmbed = (image_embeds.normalize(2, -1).tolist() as number[][])[0];
    const scores = scoreImage(imageEmbed, textEmbeds, prompts);
    const ms = performance.now() - start;
    const pick = pickObject(scores, ZEROSHOT_THRESHOLD);
    const raw: ZeroshotRaw = { ...scores, threshold: ZEROSHOT_THRESHOLD };
    return {
      recognitions: pick ? [{ objectId: pick.objectId!, score: pick.prob, by: "zeroshot" as const }] : [],
      ms,
      raw,
    };
  },
};
