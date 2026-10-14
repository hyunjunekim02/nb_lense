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
const stage1Ids = new Set(stage1Objects.flatMap((o) => o.prizes.map((l) => l.prizeId)));
const stage2 = prizes.filter((p) => !stage1Ids.has(p.id)).map((p) => p.id);
console.log(
  `[check-data] 도감: 1차 노벨상 ${prizes.length - stage2.length}개 · 2차 ${stage2.length}개 (${stage2.join(", ")}) · 1차 사물 ${stage1Objects.length}종`,
);

const unverified = prizes.filter((p) => !p.verified).map((p) => p.id);
if (unverified.length) {
  console.warn(
    `\n⚠️  [check-data] 팀 검수 전(verified: false) 노벨상 ${unverified.length}개: ${unverified.join(", ")}\n` +
      `   배포 전 문구를 검수하고 모두 true로 바꾸세요.\n`,
  );
}
if (errors) process.exit(1);
