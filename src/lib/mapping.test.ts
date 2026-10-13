import { describe, expect, it } from "vitest";
import { filterByObject, objectsFromDetections, objectsFromIds, prizesForObjects } from "./mapping";
import { OBJECTS, PRIZES, PRIZE_BY_ID } from "../data";
import type { Detection, ObjectEntry, PrizeEntry } from "../types";

const prize = (id: string, year: number): PrizeEntry => ({
  id,
  year,
  category: "physics",
  categoryKo: "물리학상",
  laureates: [],
  motivationEn: "",
  titleKo: id,
  descKo: "",
  sourceUrl: "",
  verified: true,
});

const prizes = [prize("2014-physics", 2014), prize("1956-physics", 1956), prize("2009-physics-fiber", 2009), prize("2009-physics-ccd", 2009)];
const objects: ObjectEntry[] = [
  {
    id: "phone",
    nameKo: "스마트폰",
    cocoClass: "cell phone",
    icon: "phone.svg",
    prizes: [
      { prizeId: "2014-physics", whereKo: "LED" },
      { prizeId: "2009-physics-fiber", whereKo: "광섬유" },
      { prizeId: "1956-physics", whereKo: "트랜지스터" },
      { prizeId: "2009-physics-ccd", whereKo: "CCD" },
    ],
  },
  { id: "tv", nameKo: "TV", cocoClass: "tv", icon: "tv.svg", prizes: [{ prizeId: "2014-physics", whereKo: "백라이트" }] },
  { id: "empty", nameKo: "빈 사물", cocoClass: "cup", icon: "x.svg", prizes: [] },
  { id: "led_bulb", nameKo: "LED 전구", icon: "led.svg", prizes: [{ prizeId: "2014-physics", whereKo: "조명" }] },
];
const catalog = { objects, prizeById: new Map(prizes.map((p) => [p.id, p])) };

const det = (cocoClass: string, score: number): Detection => ({
  cocoClass,
  score,
  box: { x: 0, y: 0, width: 0.1, height: 0.1 },
});

describe("objectsFromDetections", () => {
  it("같은 클래스가 여러 번 잡혀도 사물 하나로 합친다", () => {
    const result = objectsFromDetections([det("cell phone", 0.5), det("cell phone", 0.9)], catalog);
    expect(result.map((o) => o.id)).toEqual(["phone"]);
  });

  it("매핑 없는 클래스와 노벨상이 없는 사물은 무시한다", () => {
    const result = objectsFromDetections([det("dog", 0.99), det("cup", 0.8), det("tv", 0.4)], catalog);
    expect(result.map((o) => o.id)).toEqual(["tv"]);
  });

  it("가장 높은 점수 순으로 정렬한다", () => {
    const result = objectsFromDetections([det("tv", 0.6), det("cell phone", 0.4), det("cell phone", 0.7)], catalog);
    expect(result.map((o) => o.id)).toEqual(["phone", "tv"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(objectsFromDetections([], catalog)).toEqual([]);
  });
});

describe("objectsFromIds", () => {
  it("중복과 알 수 없는 ID를 제거하고 순서를 유지한다", () => {
    const result = objectsFromIds(["led_bulb", "nope", "phone", "led_bulb"], catalog);
    expect(result.map((o) => o.id)).toEqual(["led_bulb", "phone"]);
  });
});

describe("prizesForObjects", () => {
  it("여러 사물에 걸친 같은 노벨상은 한 장으로 합친다", () => {
    const hits = prizesForObjects([objects[0], objects[1]], catalog);
    expect(hits.map((h) => h.prize.id)).toEqual(["1956-physics", "2009-physics-ccd", "2009-physics-fiber", "2014-physics"]);
    const led = hits.find((h) => h.prize.id === "2014-physics")!;
    expect(led.where.map((w) => w.objectId)).toEqual(["phone", "tv"]);
  });

  it("연도 오름차순, 같은 해는 ID 순으로 정렬한다", () => {
    const years = prizesForObjects([objects[0]], catalog).map((h) => h.prize.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("존재하지 않는 노벨상 ID는 건너뛴다", () => {
    const broken: ObjectEntry = { ...objects[1], prizes: [{ prizeId: "1900-none", whereKo: "?" }] };
    expect(prizesForObjects([broken], catalog)).toEqual([]);
  });
});

describe("filterByObject", () => {
  it("선택한 사물이 들어 있는 카드만 남긴다", () => {
    const hits = prizesForObjects([objects[0], objects[1]], catalog);
    expect(filterByObject(hits, "tv").map((h) => h.prize.id)).toEqual(["2014-physics"]);
    expect(filterByObject(hits, null)).toHaveLength(4);
  });
});

describe("실제 데이터 무결성", () => {
  it("모든 사물의 노벨상 ID가 prizes.json에 있다", () => {
    for (const o of OBJECTS) for (const p of o.prizes) expect(PRIZE_BY_ID.has(p.prizeId), `${o.id} → ${p.prizeId}`).toBe(true);
  });

  it("ID가 중복되지 않는다", () => {
    expect(new Set(OBJECTS.map((o) => o.id)).size).toBe(OBJECTS.length);
    expect(new Set(PRIZES.map((p) => p.id)).size).toBe(PRIZES.length);
  });

  it("모든 노벨상에 출처 링크와 수상 사유가 있다", () => {
    for (const p of PRIZES) {
      expect(p.sourceUrl).toMatch(/^https:\/\/www\.nobelprize\.org\//);
      expect(p.motivationEn.length).toBeGreaterThan(0);
      expect(p.laureates.length).toBeGreaterThan(0);
    }
  });
});
