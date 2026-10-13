// 서비스 전역 설정. 공개 서비스명은 미정이라(명세 11장) 여기 한 곳에서만 관리한다.

/** 서비스 표시 이름. "노벨 렌즈"는 작업명이며, 공개명이 정해지면 이 값만 바꾼다. */
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

/** P2 AI 대체 인식. 기본 OFF (명세 5.2). MVP에는 구현하지 않았다. */
export const ENABLE_AI_FALLBACK = import.meta.env.VITE_ENABLE_AI_FALLBACK === "true";

/** 결과 하단에서 "이 렌즈의 인식 모델도 인공신경망" 문구가 가리키는 카드 */
export const NEURAL_NET_PRIZE_ID = "2024-physics";
