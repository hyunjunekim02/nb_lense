export type PrizeCategory = "physics" | "chemistry" | "medicine";

export type ObjectEntry = {
  id: string;
  nameKo: string;
  /** COCO 클래스명. 없으면 인식되지 않아 앱에 나오지 않는다 */
  cocoClass?: string;
  /** public/icons 안의 단색 SVG 파일명 */
  icon: string;
  /** 도감 잠긴 칸 힌트. 1차 사물(cocoClass 있음)은 필수, 사물 이름을 직접 말하지 않는다 */
  hintKo?: string;
  /** 2단계 제로샷 인식용 영어 라벨 (준비 중, 지금은 비어 있어도 된다) */
  zeroshotLabelsEn?: string[];
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

export type ScanSource = "upload" | "sample";

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
  /** 업로드 스캔으로 도감에 새로 담긴 것 (예시 사진은 없음) */
  collected?: {
    newPrizeIds: string[];
    /** 이번 스캔에서 처음 도달한 마일스톤 중 가장 높은 것 */
    milestone?: Milestone;
    /** 스캔 후 1차 노벨상 수집 개수 */
    count: number;
  };
};

export type Milestone = "first" | "half" | "complete";
