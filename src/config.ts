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

/** 예시 사진. 팀이 직접 찍은 사진으로 교체한다(명세 11장 3번). */
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

/**
 * 단계별 인식 엔진 (v1.1 명세 5장). 작은 모델이 먼저 처리하고, 못 찾은 것만 다음 단계로 넘긴다.
 * 1단계: 기기 안 COCO 검출 / 2단계: 기기 안 제로샷 분류 / 3단계: 서버 비전 LLM
 */
export const RECOGNIZERS = {
  coco: true,
  zeroshot: false, // 2단계: 준비 중
  llm: false, // 3단계: 준비 중
} as const;

/** 도감 기록 localStorage 키. 형식을 바꾸면 버전을 올린다 */
export const COLLECTION_STORAGE_KEY = "nb_lense.collection.v1";

/** 결과 하단에서 "이 렌즈의 인식 모델도 인공신경망" 문구가 가리키는 카드 */
export const NEURAL_NET_PRIZE_ID = "2024-physics";

/**
 * 검수·임계값 조정용 디버그 모드. 주소 뒤에 ?debug 를 붙이면 켜진다 (로컬·Pages 모두).
 * 켜지면 80개 COCO 클래스를 낮은 점수까지 모두 받아 결과 화면에 점수표로 보여준다.
 * ?debug&threshold=0.25 처럼 임계값을 바꿔 실험할 수 있다.
 */
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEBUG = params.has("debug");
const thresholdParam = Number(params.get("threshold"));
/** 실제로 결과에 쓰는 임계값 */
export const SCORE_THRESHOLD =
  DEBUG && thresholdParam > 0 && thresholdParam < 1 ? thresholdParam : DETECTOR.scoreThreshold;
/** 디버그 모드에서 모델이 돌려주는 최저 점수 */
export const DEBUG_MIN_SCORE = 0.1;
