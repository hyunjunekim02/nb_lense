import objectsJson from "./objects.json";
import prizesJson from "./prizes.json";
import type { ObjectEntry, PrizeEntry } from "../types";

export const OBJECTS = objectsJson as ObjectEntry[];
export const PRIZES = prizesJson as PrizeEntry[];

export const PRIZE_BY_ID = new Map(PRIZES.map((p) => [p.id, p]));
export const OBJECT_BY_ID = new Map(OBJECTS.map((o) => [o.id, o]));

/** MediaPipe categoryAllowlist에 넣을 COCO 클래스명 */
export const COCO_ALLOWLIST = OBJECTS.flatMap((o) => (o.cocoClass ? [o.cocoClass] : []));
