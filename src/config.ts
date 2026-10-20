// 서비스 전역 설정.

/** 서비스 표시 이름 (공개명 확정). 화면·공유 카드·탭 제목에 쓰고, index.html의 메타 태그도 함께 맞춘다. */
export const SERVICE_NAME = "노벨 렌즈";

export const GITHUB_URL = "https://github.com/hyunjunekim02/nb_lense";

/** 정적 자산 경로. GitHub Pages 하위 경로(base)를 반영한다. */
export const ASSET_BASE = import.meta.env.BASE_URL;

export const DETECTOR = {
  modelPath: `${ASSET_BASE}models/efficientdet_lite0_uint8.tflite`,
  wasmPath: `${ASSET_BASE}wasm`,
  /** 실기기 측정 후 조정 (명세 5.1) */
  scoreThreshold: 0.35,
  maxResults: 10,
  /** 추론 전 긴 변 기준 최대 크기(px) */
  maxImageSide: 1024,
} as const;

/** 인물이 실재하지 않는 AI 생성 예시 사진. */
export const SAMPLES = [
  { src: `${ASSET_BASE}samples/sample-1.jpg`, label: "책상 위 폰과 노트북" },
  { src: `${ASSET_BASE}samples/sample-2.jpg`, label: "거리의 신호등과 자동차" },
  { src: `${ASSET_BASE}samples/sample-3.jpg`, label: "사람과 시계" },
] as const;

/**
 * 쿠키 없는 분석(GoatCounter). 사이트 코드가 비어 있으면 아무것도 전송하지 않는다.
 * 예: VITE_GOATCOUNTER_CODE=nobellens → https://nobellens.goatcounter.com
 */
export const GOATCOUNTER_CODE: string = import.meta.env.VITE_GOATCOUNTER_CODE ?? "";

/** 주소 쿼리 (?debug, ?zeroshot 같은 실험용 스위치) */
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();

/**
 * 단계별 인식 엔진 (v1.1 명세 5장). 작은 모델이 먼저 처리하고, 못 찾은 것만 다음 단계로 넘긴다.
 * 1단계: 기기 안 COCO 검출 / 2단계: 기기 안 제로샷 분류 / 3단계: 서버 비전 LLM
 */
export const RECOGNIZERS = {
  coco: true,
  /** 2단계: 1차 도감을 완성해 2차 도감이 열린 사람에게만 돌린다 (ZEROSHOT_FORCE 참고) */
  zeroshot: true,
  llm: false, // 3단계: 기반만 준비 (LLM 아래 참고). 켜기 전에 사진 전송 동의 화면이 필요하다
} as const;

/**
 * 3단계 비전 LLM (v1.1 명세 5.3). 사진을 운영자가 띄운 프록시(proxy/, Cloudflare Worker)로 보내고,
 * 프록시가 운영자 키로 OpenAI·Claude·Gemini·POSTECH AI 중 설정된 곳에 물어 사물 ID 하나를 받는다.
 * 키는 프록시에만 있고 이 번들에는 들어가지 않는다. 주소가 비어 있으면 3단계는 꺼진다.
 * 예: VITE_LLM_ENDPOINT=https://nb-lense-llm-proxy.<계정>.workers.dev
 */
export const LLM = {
  endpoint: (import.meta.env.VITE_LLM_ENDPOINT ?? "").replace(/\/+$/, ""),
  /** LLM이 답한 확신도가 이 값 이상이어야 인정한다 */
  threshold: 0.6,
  /** 보내기 전에 긴 변을 이 크기(px)로 줄인다 (전송량·비용 절약) */
  maxImageSide: 768,
  jpegQuality: 0.8,
  timeoutMs: 20_000,
} as const;

/**
 * 2단계 제로샷 분류 (MobileCLIP, Transformers.js). 1단계 결과와 상관없이 사진 전체를
 * 사물 라벨 문장들(objects.json의 zeroshotLabelsEn)과 비교해 가장 가까운 사물 하나를 고른다.
 * 2차 도감이 열린 뒤(또는 ?zeroshot)에만 돌린다.
 * 모델은 처음 쓸 때 Hugging Face에서 받고 브라우저 캐시에 남긴다.
 */
/** ?zeroshot: 2차 도감이 열리기 전에도 2단계를 돌려 본다 (실험용. 이때 찾은 2차 노벨상은 도감에 담지 않는다) */
export const ZEROSHOT_FORCE = params.has("zeroshot");

export const ZEROSHOT = {
  modelId: "Xenova/mobileclip_s0",
  /** 라벨 앞에 붙이는 문장 틀 */
  promptTemplate: "a photo of {}",
  /**
   * 어느 사물에도 해당하지 않는 사진을 걸러 내는 라벨. 이쪽이 이기면 아무것도 찾지 않은 것으로 본다
   */
  negativeLabelsEn: [
    "a room",
    "a person",
    "a selfie",
    "food on a table",
    "a street",
    "a building",
    "a landscape",
    "a desk",
    "a pet",
    "a screenshot",
    "a document with text",
  ],
  /** 사물 하나의 확률(그 사물 라벨들의 softmax 합)이 이 값 이상이어야 인정한다. 실기기 실험 후 조정 */
  threshold: 0.5,
} as const;

/**
 * 테스트용 도감. 주소에 ?unlock 을 붙이면 1차 도감이 다 채워진(2차가 열린) 별도 도감으로 연다.
 * 실제 기록과 다른 키에 저장하므로 원래 도감은 그대로 남는다. 예: ?unlock&zeroshot&debug
 */
export const TEST_UNLOCK = params.has("unlock");

/** 도감 기록 localStorage 키. 형식을 바꾸면 버전을 올린다 */
export const COLLECTION_STORAGE_KEY = TEST_UNLOCK ? "nb_lense.collection.test.v1" : "nb_lense.collection.v1";

/** 결과 하단에서 "이 렌즈의 인식 모델도 인공신경망" 문구가 가리키는 카드 */
export const NEURAL_NET_PRIZE_ID = "2024-physics";

/**
 * 검수·임계값 조정용 디버그 모드. 주소 뒤에 ?debug 를 붙이면 켜진다 (로컬·Pages 모두).
 * 켜지면 80개 COCO 클래스를 낮은 점수까지 모두 받아 결과 화면에 점수표로 보여준다.
 * ?debug&threshold=0.25 처럼 임계값을 바꿔 실험할 수 있다.
 */
export const DEBUG = params.has("debug");
const thresholdParam = Number(params.get("threshold"));
/** 실제로 결과에 쓰는 임계값 */
export const SCORE_THRESHOLD =
  DEBUG && thresholdParam > 0 && thresholdParam < 1 ? thresholdParam : DETECTOR.scoreThreshold;
/** 디버그 모드에서 모델이 돌려주는 최저 점수 */
export const DEBUG_MIN_SCORE = 0.1;
const zsThresholdParam = Number(params.get("zs"));
/** 2단계 제로샷 임계값. ?zeroshot&zs=0.4 처럼 바꿔 실험할 수 있다 */
export const ZEROSHOT_THRESHOLD = zsThresholdParam > 0 && zsThresholdParam < 1 ? zsThresholdParam : ZEROSHOT.threshold;
