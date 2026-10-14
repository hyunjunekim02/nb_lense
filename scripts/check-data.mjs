// 빌드 전 데이터 검사. 참조가 깨졌으면 빌드를 멈추고, 검수 전(verified: false) 항목은 경고만 한다.
import { readFileSync } from "node:fs";

const prizes = JSON.parse(readFileSync("src/data/prizes.json", "utf8"));
const objects = JSON.parse(readFileSync("src/data/objects.json", "utf8"));
const ids = new Set(prizes.map((p) => p.id));
let errors = 0;

for (const o of objects) {
  for (const link of o.prizes) {
    if (!ids.has(link.prizeId)) {
      console.error(`[check-data] ${o.id}: 알 수 없는 노벨상 ID ${link.prizeId}`);
      errors++;
    }
  }
}
for (const p of prizes) {
  if (!p.sourceUrl || !p.motivationEn || p.laureates.length === 0) {
    console.error(`[check-data] ${p.id}: sourceUrl/motivationEn/laureates 누락`);
    errors++;
  }
}

// 1차 = 1단계(COCO)로 인식되는 사물에 연결된 노벨상, 2차 = 그 밖 (src/lib/collection.ts의 computeTiers와 같은 규칙)
const stage1Objects = objects.filter((o) => o.cocoClass && o.prizes.length > 0);
for (const o of stage1Objects) {
  if (!o.hintKo) {
    console.error(`[check-data] ${o.id}: 1차 사물은 도감 잠긴 칸 힌트(hintKo)가 필요합니다`);
    errors++;
  }
}
// 2단계(제로샷) 사물: 영어 라벨이 있는 비COCO 사물. 잠긴 칸 힌트가 필요하다
const stage2Objects = objects.filter((o) => !o.cocoClass && o.zeroshotLabelsEn?.length && o.prizes.length > 0);
for (const o of stage2Objects) {
  if (!o.hintKo) {
    console.error(`[check-data] ${o.id}: 2단계(제로샷) 사물은 도감 잠긴 칸 힌트(hintKo)가 필요합니다`);
    errors++;
  }
}
const labels = new Map();
for (const o of objects) {
  for (const label of o.zeroshotLabelsEn ?? []) {
    if (labels.has(label)) {
      console.error(`[check-data] ${o.id}: 제로샷 라벨 "${label}"이 ${labels.get(label)}와 겹칩니다`);
      errors++;
    }
    labels.set(label, o.id);
  }
}
const stage1Ids = new Set(stage1Objects.flatMap((o) => o.prizes.map((l) => l.prizeId)));
const stage2 = prizes.filter((p) => !stage1Ids.has(p.id)).map((p) => p.id);
const photoIds = new Set(stage2Objects.flatMap((o) => o.prizes.map((l) => l.prizeId)));
const stage2Photo = stage2.filter((id) => photoIds.has(id));
console.log(
  `[check-data] 도감: 1차 노벨상 ${prizes.length - stage2.length}개 · 2차 ${stage2.length}개` +
    `(사진으로 ${stage2Photo.length}개) · 1차 사물 ${stage1Objects.length}종 · 2차 사물 ${stage2Objects.length}종`,
);

const unverified = prizes.filter((p) => !p.verified).map((p) => p.id);
if (unverified.length) {
  console.warn(
    `\n⚠️  [check-data] 팀 검수 전(verified: false) 노벨상 ${unverified.length}개: ${unverified.join(", ")}\n` +
      `   배포 전 문구를 검수하고 모두 true로 바꾸세요.\n`,
  );
}
if (errors) process.exit(1);
