import type { Detection, ObjectEntry, PrizeEntry, PrizeHit } from "../types";

type Catalog = {
  objects: ObjectEntry[];
  prizeById: Map<string, PrizeEntry>;
};

/**
 * 인식된 COCO 클래스 → 사물. 같은 클래스가 여러 번 잡혀도 사물 하나로 합치고,
 * 매핑이 없는 클래스는 무시한다. 순서는 가장 높은 점수 순.
 */
export function objectsFromDetections(detections: Detection[], catalog: Catalog): ObjectEntry[] {
  const best = new Map<string, number>();
  for (const d of detections) {
    const obj = catalog.objects.find((o) => o.cocoClass === d.cocoClass);
    if (!obj || obj.prizes.length === 0) continue;
    best.set(obj.id, Math.max(best.get(obj.id) ?? 0, d.score));
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => catalog.objects.find((o) => o.id === id)!);
}

/** 사물 ID 목록 → 사물 (중복·알 수 없는 ID 제거, 입력 순서 유지) */
export function objectsFromIds(ids: string[], catalog: Catalog): ObjectEntry[] {
  const seen = new Set<string>();
  const out: ObjectEntry[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const obj = catalog.objects.find((o) => o.id === id);
    if (!obj) continue;
    seen.add(id);
    out.push(obj);
  }
  return out;
}

/**
 * 사물 → 노벨상 카드. 같은 노벨상은 한 장으로 합치고(어디에 들어 있는지는 사물별로 모음),
 * 연도 오름차순(같은 해는 ID 순)으로 정렬한다.
 */
export function prizesForObjects(objects: ObjectEntry[], catalog: Catalog): PrizeHit[] {
  const hits = new Map<string, PrizeHit>();
  for (const obj of objects) {
    for (const link of obj.prizes) {
      const prize = catalog.prizeById.get(link.prizeId);
      if (!prize) continue;
      let hit = hits.get(prize.id);
      if (!hit) {
        hit = { prize, where: [] };
        hits.set(prize.id, hit);
      }
      hit.where.push({ objectId: obj.id, whereKo: link.whereKo });
    }
  }
  return [...hits.values()].sort(
    (a, b) => a.prize.year - b.prize.year || a.prize.id.localeCompare(b.prize.id),
  );
}

/** 칩으로 사물 하나를 골랐을 때 그 사물의 카드만 남긴다 */
export function filterByObject(hits: PrizeHit[], objectId: string | null): PrizeHit[] {
  if (!objectId) return hits;
  return hits.filter((h) => h.where.some((w) => w.objectId === objectId));
}
