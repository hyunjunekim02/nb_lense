export type PrizeCategory = "physics" | "chemistry" | "medicine";

export type ObjectEntry = {
  id: string;
  nameKo: string;
  /** COCO 클래스명. 없으면 직접 고르기 전용 */
  cocoClass?: string;
  /** public/icons 안의 단색 SVG 파일명 */
  icon: string;
  prizes: { prizeId: string; whereKo: string }[];
};

export type PrizeEntry = {
  id: string;
  year: number;
  category: PrizeCategory;
  categoryKo: string;
  laureates: string[];
  motivationEn: string;
  titleKo: string;
  descKo: string;
  sourceUrl: string;
  verified: boolean;
};

/** 인식기 출력 한 건 (원본 이미지 기준 0~1 정규화 좌표) */
export type Detection = {
  cocoClass: string;
  score: number;
  box: { x: number; y: number; width: number; height: number };
};

/** 결과 화면의 노벨상 카드 한 장: 노벨상 + 그것이 들어 있는 사물들 */
export type PrizeHit = {
  prize: PrizeEntry;
  where: { objectId: string; whereKo: string }[];
};

export type ScanSource = "upload" | "sample" | "manual";

export type ScanResult = {
  source: ScanSource;
  objects: ObjectEntry[];
  prizes: PrizeHit[];
  /** 결과에 쓴 인식 (임계값·허용 목록 통과) */
  detections: Detection[];
  /** 디버그 모드 점수표용 원본 인식 */
  rawDetections?: Detection[];
  /** 업로드·예시일 때 화면에 보여줄 사진 (object URL) */
  imageUrl?: string;
  /** 추론 시간 (ms) */
  inferenceMs?: number;
};
