import { COLLECTION_STORAGE_KEY, RECOGNIZERS } from "../config";
import { OBJECTS, PRIZES } from "../data";
import type { Milestone, ObjectEntry, PrizeEntry, PrizeHit, ScanSource } from "../types";

/**
 * 노벨상 도감 (v1.1 명세 3·7장). 사진은 저장하지 않고 ID와 날짜만 브라우저(localStorage)에 남긴다.
 * 1차·2차 구분은 데이터에서 자동 계산한다: 1단계(COCO)로 인식되는 사물에 연결된 노벨상이 1차.
 * 2차 도감은 1차 도감을 모두 채우면 열린다. 2차 중 2단계(제로샷)로 인식되는 사물에 연결된 노벨상은
 * 그때부터 사진으로 모을 수 있고, 나머지는 열람만 한다.
 */

export type CollectionState = {
  version: 1;
  /** firstAt: 처음 찾은 날짜 (YYYY-MM-DD) */
  prizes: Record<string, { firstAt: string; objectId: string; count: number }>;
  objects: Record<string, { firstAt: string; count: number }>;
  milestones: Partial<Record<Milestone, string>>;
  /** 업로드 스캔 횟수 */
  scans: number;
  ui: { installHintDismissed?: boolean };
};

type Catalog = { objects: ObjectEntry[]; prizes: PrizeEntry[] };

export type Tiers = {
  /** 1차 노벨상 ID (연도 오름차순) */
  stage1: string[];
  /** 2차 노벨상 ID (연도 오름차순) */
  stage2: string[];
  /** 1차 사물 ID (1단계로 인식 가능) */
  stage1Objects: string[];
  /** 2차 중 사진으로 모을 수 있는 노벨상 ID (2단계 제로샷 사물에 연결됨, 연도 오름차순) */
  stage2Photo: string[];
  /** 2단계(제로샷)로 인식하는 사물 ID */
  stage2Objects: string[];
};

const byYear = (a: PrizeEntry, b: PrizeEntry) => a.year - b.year || a.id.localeCompare(b.id);

export function computeTiers(catalog: Catalog): Tiers {
  const stage1Objects = catalog.objects.filter((o) => o.cocoClass && o.prizes.length > 0);
  const stage1Ids = new Set(stage1Objects.flatMap((o) => o.prizes.map((l) => l.prizeId)));
  const stage2Objects = catalog.objects.filter((o) => !o.cocoClass && o.zeroshotLabelsEn?.length && o.prizes.length > 0);
  const photoIds = new Set(stage2Objects.flatMap((o) => o.prizes.map((l) => l.prizeId)));
  const sorted = [...catalog.prizes].sort(byYear);
  const stage2 = sorted.filter((p) => !stage1Ids.has(p.id)).map((p) => p.id);
  return {
    stage1: sorted.filter((p) => stage1Ids.has(p.id)).map((p) => p.id),
    stage2,
    stage1Objects: stage1Objects.map((o) => o.id),
    stage2Photo: stage2.filter((id) => photoIds.has(id)),
    stage2Objects: stage2Objects.map((o) => o.id),
  };
}

export const TIERS = computeTiers({ objects: OBJECTS, prizes: PRIZES });

export function tierOf(prizeId: string, tiers: Tiers = TIERS): 1 | 2 | undefined {
  if (tiers.stage1.includes(prizeId)) return 1;
  if (tiers.stage2.includes(prizeId)) return 2;
  return undefined;
}

/** 2차 노벨상 중 지금 사진으로 모을 수 있는가 (2단계 제로샷이 켜져 있고 제로샷 사물에 연결됨) */
export function isStage2Photo(prizeId: string, enabled: boolean = RECOGNIZERS.zeroshot, tiers: Tiers = TIERS): boolean {
  return enabled && tiers.stage2Photo.includes(prizeId);
}

export function emptyState(): CollectionState {
  return { version: 1, prizes: {}, objects: {}, milestones: {}, scans: 0, ui: {} };
}

export type Progress = {
  prizes: number;
  prizeTotal: number;
  objects: number;
  objectTotal: number;
  /** 1차 도감을 모두 채우면 2차 도감이 열린다 */
  stage2Unlocked: boolean;
  /** 2차 중 사진으로 모은 노벨상 수 / 사진으로 모을 수 있는 수 */
  stage2Prizes: number;
  stage2PrizeTotal: number;
  /**
   * 화면에 보여줄 전체 개수. 2차 도감이 열리면 사진으로 모을 수 있는 2차까지 합친다
   * (마일스톤은 계속 1차 기준)
   */
  found: number;
  total: number;
  /** found에 해당하는 노벨상 ID (연도 오름차순, 도감 공유 카드용) */
  foundIds: string[];
};

/** 데이터에서 사라진 ID는 기록에 남아 있어도 세지 않는다 */
export function progress(state: CollectionState, tiers: Tiers = TIERS): Progress {
  const prizes = tiers.stage1.filter((id) => state.prizes[id]).length;
  const objects = tiers.stage1Objects.filter((id) => state.objects[id]).length;
  const stage2Unlocked = tiers.stage1.length > 0 && prizes >= tiers.stage1.length;
  const counted = stage2Unlocked ? [...tiers.stage1, ...tiers.stage2Photo] : tiers.stage1;
  const foundIds = counted.filter((id) => state.prizes[id]);
  const order = new Map(PRIZES.map((p) => [p.id, p.year]));
  foundIds.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b));
  return {
    prizes,
    prizeTotal: tiers.stage1.length,
    objects,
    objectTotal: tiers.stage1Objects.length,
    stage2Unlocked,
    stage2Prizes: tiers.stage2Photo.filter((id) => state.prizes[id]).length,
    stage2PrizeTotal: tiers.stage2Photo.length,
    found: foundIds.length,
    total: counted.length,
    foundIds,
  };
}

function reached(p: Progress): Milestone[] {
  const out: Milestone[] = [];
  if (p.prizes >= 1) out.push("first");
  if (p.prizeTotal > 0 && p.prizes >= Math.ceil(p.prizeTotal / 2)) out.push("half");
  if (p.prizeTotal > 0 && p.prizes >= p.prizeTotal) out.push("complete");
  return out;
}

/** 배너에 하나만 보여줄 때의 우선순위 (높은 것부터) */
const MILESTONE_ORDER: Milestone[] = ["complete", "half", "first"];

export function topMilestone(milestones: Milestone[]): Milestone | undefined {
  return MILESTONE_ORDER.find((m) => milestones.includes(m));
}

export type ScanInput = { source: ScanSource; objects: ObjectEntry[]; prizes: PrizeHit[] };

export type ApplyResult = {
  state: CollectionState;
  newPrizeIds: string[];
  newObjectIds: string[];
  /** 이번 스캔에서 처음 도달한 마일스톤 */
  milestones: Milestone[];
};

export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 스캔 결과를 도감에 반영한다. 업로드 사진만 수집하고, 예시 사진은 상태를 바꾸지 않는다.
 * 같은 노벨상을 다시 찾으면 count만 늘리고 firstAt은 유지한다. 입력 state는 바꾸지 않는다.
 * 2차 노벨상은 스캔 전에 2차 도감이 열려 있었을 때만 담는다.
 */
export function applyScan(state: CollectionState, scan: ScanInput, now: Date = new Date(), tiers: Tiers = TIERS): ApplyResult {
  if (scan.source !== "upload") return { state, newPrizeIds: [], newObjectIds: [], milestones: [] };

  const date = today(now);
  const stage2Open = progress(state, tiers).stage2Unlocked;
  const next: CollectionState = {
    ...state,
    prizes: { ...state.prizes },
    objects: { ...state.objects },
    milestones: { ...state.milestones },
    scans: state.scans + 1,
  };
  const newObjectIds: string[] = [];
  const newPrizeIds: string[] = [];

  for (const obj of scan.objects) {
    const cur = next.objects[obj.id];
    if (cur) next.objects[obj.id] = { ...cur, count: cur.count + 1 };
    else {
      next.objects[obj.id] = { firstAt: date, count: 1 };
      newObjectIds.push(obj.id);
    }
  }
  for (const hit of scan.prizes) {
    const id = hit.prize.id;
    if (!stage2Open && tierOf(id, tiers) === 2) continue;
    const cur = next.prizes[id];
    if (cur) next.prizes[id] = { ...cur, count: cur.count + 1 };
    else {
      next.prizes[id] = { firstAt: date, objectId: hit.where[0]?.objectId ?? "", count: 1 };
      newPrizeIds.push(id);
    }
  }

  const milestones = reached(progress(next, tiers)).filter((m) => !next.milestones[m]);
  for (const m of milestones) next.milestones[m] = date;

  return { state: next, newPrizeIds, newObjectIds, milestones };
}

/** 노벨상 칸 아이콘: 처음 찾은 사물 → 연결된 첫 사물 → 부문 아이콘 순 */
export function iconFor(prizeId: string, objectId?: string, objects: ObjectEntry[] = OBJECTS): string {
  const obj =
    (objectId && objects.find((o) => o.id === objectId)) || objects.find((o) => o.prizes.some((l) => l.prizeId === prizeId));
  if (obj) return obj.icon;
  const category = PRIZES.find((p) => p.id === prizeId)?.category;
  return category === "chemistry" ? "flask-conical" : category === "medicine" ? "heart-pulse" : "atom";
}

/** 도감 칸을 눌렀을 때 시트의 "이 물건 속에서". 1차는 1차 사물만, 2차는 연결된 사물 전체 */
export function whereFor(prizeId: string, catalog: Catalog = { objects: OBJECTS, prizes: PRIZES }, tiers: Tiers = TIERS) {
  const tier = tierOf(prizeId, tiers);
  return catalog.objects
    .filter((o) => tier !== 1 || tiers.stage1Objects.includes(o.id))
    .flatMap((o) => o.prizes.filter((l) => l.prizeId === prizeId).map((l) => ({ objectId: o.id, whereKo: l.whereKo })));
}

/** 잠긴 칸 힌트: 이 노벨상에 연결된, 사진으로 찾을 수 있는 사물 중 첫 번째의 hintKo (1차 사물 우선) */
export function hintFor(prizeId: string, objects: ObjectEntry[] = OBJECTS, tiers: Tiers = TIERS): string | undefined {
  const linked = (ids: string[]) =>
    objects.find((o) => ids.includes(o.id) && o.hintKo && o.prizes.some((l) => l.prizeId === prizeId))?.hintKo;
  return linked(tiers.stage1Objects) ?? linked(tiers.stage2Objects);
}

// ---------- 저장소 ----------

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isValid(v: unknown): v is CollectionState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const isRecord = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x);
  return (
    s.version === 1 &&
    isRecord(s.prizes) &&
    isRecord(s.objects) &&
    isRecord(s.milestones) &&
    typeof s.scans === "number" &&
    isRecord(s.ui)
  );
}

/**
 * 저장된 도감을 읽는다. 저장소를 쓸 수 없으면 persistent: false로 빈 도감을 돌려주고(메모리로 동작),
 * 깨졌거나 알 수 없는 버전이면 원본을 .bak 키에 남기고 새로 시작한다.
 */
export function load(storage: StorageLike | null = defaultStorage()): { state: CollectionState; persistent: boolean } {
  if (!storage) return { state: emptyState(), persistent: false };
  let raw: string | null;
  try {
    raw = storage.getItem(COLLECTION_STORAGE_KEY);
    // 읽기만 되고 쓰기는 막힌 환경을 걸러낸다
    const probe = `${COLLECTION_STORAGE_KEY}.probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch {
    return { state: emptyState(), persistent: false };
  }
  if (raw == null) return { state: emptyState(), persistent: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return { state: parsed, persistent: true };
  } catch {
    // 아래에서 백업 후 새로 시작
  }
  try {
    storage.setItem(`${COLLECTION_STORAGE_KEY}.bak`, raw);
  } catch {
    // 백업 실패는 무시
  }
  return { state: emptyState(), persistent: true };
}

export function save(state: CollectionState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** 테스트용(?unlock): 1차 도감에서 빠진 칸을 모두 채워 2차 도감을 연다. 이미 찾은 기록은 그대로 둔다 */
export function unlockStage1(state: CollectionState, now: Date = new Date(), tiers: Tiers = TIERS): CollectionState {
  const date = today(now);
  const next: CollectionState = { ...state, prizes: { ...state.prizes }, objects: { ...state.objects } };
  for (const objectId of tiers.stage1Objects) next.objects[objectId] ??= { firstAt: date, count: 1 };
  for (const id of tiers.stage1) {
    const objectId = OBJECTS.find((o) => tiers.stage1Objects.includes(o.id) && o.prizes.some((l) => l.prizeId === id))!.id;
    next.prizes[id] ??= { firstAt: date, objectId, count: 1 };
  }
  next.milestones = { first: date, half: date, complete: date, ...state.milestones };
  return next;
}

/** 기록 지우기. 홈 화면 추가 안내를 닫은 기록 같은 화면 설정은 남긴다 */
export function reset(state: CollectionState): CollectionState {
  return { ...emptyState(), ui: state.ui };
}
