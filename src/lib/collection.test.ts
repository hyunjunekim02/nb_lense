import { describe, expect, it } from "vitest";
import { COLLECTION_STORAGE_KEY } from "../config";
import { OBJECT_BY_ID, OBJECTS, PRIZE_BY_ID } from "../data";
import { applyScan, emptyState, hintFor, iconFor, load, progress, reset, save, TIERS, tierOf, whereFor } from "./collection";
import { prizesForObjects } from "./mapping";
import type { ScanSource } from "../types";

const catalog = { objects: OBJECTS, prizeById: PRIZE_BY_ID };
const scan = (source: ScanSource, ...ids: string[]) => {
  const objects = ids.map((id) => OBJECT_BY_ID.get(id)!);
  return { source, objects, prizes: prizesForObjects(objects, catalog) };
};
const day = (d: string) => new Date(`${d}T12:00:00`);

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("1차·2차 계산", () => {
  it("명세 3.2의 목록과 일치한다", () => {
    expect(TIERS.stage1).toEqual([
      "1909-physics",
      "1913-physics",
      "1918-chemistry",
      "1921-physics",
      "1924-medicine",
      "1929-medicine-eijkman",
      "1930-medicine",
      "1937-chemistry-haworth",
      "1953-chemistry",
      "1956-physics",
      "1961-chemistry",
      "1962-medicine",
      "1963-chemistry",
      "1967-medicine",
      "1989-physics-clock",
      "1997-physics",
      "2000-physics-hetero",
      "2000-physics-ic",
      "2003-medicine",
      "2007-chemistry",
      "2007-physics",
      "2009-physics-ccd",
      "2009-physics-fiber",
      "2014-medicine",
      "2014-physics",
      "2017-medicine",
      "2019-chemistry",
      "2019-medicine",
      "2021-medicine",
      "2023-chemistry",
      "2024-physics",
    ]);
    expect(TIERS.stage2).toEqual(expect.arrayContaining(["1945-medicine", "1964-physics", "2023-medicine"]));
    expect(TIERS.stage1.length + TIERS.stage2.length).toBe(PRIZE_BY_ID.size);
    expect(TIERS.stage2.filter((id) => TIERS.stage1.includes(id))).toEqual([]);
    expect(TIERS.stage1Objects).toEqual([
      "phone",
      "laptop",
      "tv",
      "car",
      "traffic_light",
      "clock",
      "person",
      "potted_plant",
      "orange",
      "broccoli",
      "bottle",
      "bowl",
      "bed",
      "refrigerator",
    ]);
    expect(tierOf("2014-physics")).toBe(1);
    expect(tierOf("2023-medicine")).toBe(2);
    expect(tierOf("nope")).toBeUndefined();
  });

  it("1차 노벨상의 where는 1차 사물만, 2차는 연결된 사물 전체", () => {
    expect(whereFor("2014-physics").map((w) => w.objectId)).toEqual(["phone", "laptop", "tv", "car", "traffic_light"]);
    expect(whereFor("1945-medicine").map((w) => w.objectId)).toEqual(["antibiotic"]);
  });

  it("칸 아이콘은 사물이 없으면 부문 아이콘을 쓴다", () => {
    expect(iconFor("2014-physics", "tv")).toBe("tv.svg");
    expect(iconFor("1945-medicine")).toBe("antibiotic.svg");
    expect(iconFor("1901-physics")).toBe("atom");
    expect(iconFor("2010-chemistry")).toBe("flask-conical");
    expect(iconFor("1901-medicine")).toBe("heart-pulse");
  });

  it("잠긴 칸 힌트는 연결된 1차 사물에서 가져온다", () => {
    expect(hintFor("2007-physics")).toBe(OBJECT_BY_ID.get("laptop")!.hintKo);
    expect(hintFor("1945-medicine")).toBeUndefined();
  });
});

describe("applyScan", () => {
  it("업로드만 수집하고 예시 사진은 상태를 바꾸지 않는다", () => {
    const s0 = emptyState();
    const sample = applyScan(s0, scan("sample", "phone"));
    expect(sample.state).toBe(s0);
    expect(sample.newPrizeIds).toEqual([]);

    const up = applyScan(s0, scan("upload", "phone"));
    expect(up.newPrizeIds).toHaveLength(10);
    expect(up.newObjectIds).toEqual(["phone"]);
    expect(up.state.scans).toBe(1);
    expect(s0.scans).toBe(0);
  });

  it("다시 찾으면 count만 늘고 firstAt은 유지한다", () => {
    const a = applyScan(emptyState(), scan("upload", "phone"), day("2026-10-14")).state;
    const b = applyScan(a, scan("upload", "phone", "tv"), day("2026-10-20"));
    // TV의 양자점은 처음이고, 나머지는 스마트폰으로 이미 찾은 노벨상
    expect(b.newPrizeIds).toEqual(["2023-chemistry"]);
    expect(b.newObjectIds).toEqual(["tv"]);
    expect(b.state.prizes["2014-physics"]).toEqual({ firstAt: "2026-10-14", objectId: "phone", count: 2 });
    expect(b.state.objects.tv).toEqual({ firstAt: "2026-10-20", count: 1 });
  });

  it("마일스톤은 처음 도달했을 때 한 번만 생긴다", () => {
    const first = applyScan(emptyState(), scan("upload", "clock"));
    expect(first.milestones).toEqual(["first"]);

    // 시계 2 + 스마트폰 10 + 사람 8 = 20개로 31개의 절반(16)을 넘는다
    const half = applyScan(first.state, scan("upload", "phone", "person"));
    expect(half.milestones).toEqual(["half"]);
    expect(applyScan(half.state, scan("upload", "phone")).milestones).toEqual([]);

    const almost = applyScan(
      half.state,
      scan("upload", "laptop", "tv", "car", "potted_plant", "orange", "broccoli", "bottle", "bowl", "bed"),
    );
    expect(almost.milestones).toEqual([]);
    expect(progress(almost.state).stage2Unlocked).toBe(false);

    const complete = applyScan(almost.state, scan("upload", "refrigerator"));
    expect(complete.milestones).toEqual(["complete"]);
    expect(progress(complete.state)).toMatchObject({ prizes: 31, prizeTotal: 31, objects: 13, objectTotal: 14, stage2Unlocked: true });
  });

  it("데이터에서 사라진 ID는 진행률에서 빠진다", () => {
    const s = { ...emptyState(), prizes: { "1800-gone": { firstAt: "2026-10-14", objectId: "x", count: 1 } } };
    expect(progress(s).prizes).toBe(0);
  });
});

describe("저장소", () => {
  it("저장한 상태를 그대로 읽는다", () => {
    const storage = memoryStorage();
    const state = applyScan(emptyState(), scan("upload", "phone")).state;
    expect(save(state, storage)).toBe(true);
    expect(load(storage)).toEqual({ state, persistent: true });
  });

  it("깨진 JSON과 알 수 없는 버전은 백업하고 새로 시작한다", () => {
    for (const bad of ["{oops", JSON.stringify({ version: 9 })]) {
      const storage = memoryStorage({ [COLLECTION_STORAGE_KEY]: bad });
      expect(load(storage)).toEqual({ state: emptyState(), persistent: true });
      expect(storage.data.get(`${COLLECTION_STORAGE_KEY}.bak`)).toBe(bad);
    }
  });

  it("저장소를 쓸 수 없으면 메모리로 동작한다", () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(load(blocked).persistent).toBe(false);
    expect(load(null).persistent).toBe(false);
    expect(save(emptyState(), blocked)).toBe(false);
  });

  it("기록 지우기는 화면 설정을 남긴다", () => {
    const s = { ...applyScan(emptyState(), scan("upload", "phone")).state, ui: { installHintDismissed: true } };
    expect(reset(s)).toEqual({ ...emptyState(), ui: { installHintDismissed: true } });
  });
});
