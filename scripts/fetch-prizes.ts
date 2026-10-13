/**
 * 노벨상 공식 API v2.1에서 수상자 이름과 수상 사유(motivation) 원문을 받아
 * src/data/prizes.json의 laureates / motivationEn 필드를 채운다. 1회 실행 후 결과를 커밋한다.
 *
 *   npm run fetch-prizes
 *
 * API: https://api.nobelprize.org/2.1/nobelPrize/{category}/{year}
 *   category: phy | che | med | lit | pea | eco
 * 문서: https://www.nobelprize.org/about/developer-zone-2/
 *
 * 한 해에 주제가 둘인 상은 ID를 나눠 두었다(예: 2009-physics-fiber / 2009-physics-ccd).
 * 이런 항목은 기존 laureates의 성(마지막 단어)과 일치하는 수상자만 남긴다.
 * motivation은 약관에 따라 수정하지 않고 API 값을 그대로 쓴다.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Prize = {
  id: string;
  year: number;
  category: "physics" | "chemistry" | "medicine";
  laureates: string[];
  motivationEn: string;
  [key: string]: unknown;
};

type ApiLaureate = {
  knownName?: { en: string };
  fullName?: { en: string };
  orgName?: { en: string };
  motivation?: { en: string };
};

const API_CATEGORY = { physics: "phy", chemistry: "che", medicine: "med" } as const;
const FILE = "src/data/prizes.json";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const surname = (name: string) => normalize(name.trim().split(/\s+/).at(-1) ?? "");

async function fetchPrize(category: Prize["category"], year: number): Promise<ApiLaureate[]> {
  const url = `https://api.nobelprize.org/2.1/nobelPrize/${API_CATEGORY[category]}/${year}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const body = await res.json();
  // 단건 조회는 배열로 오는 경우가 있다
  const prize = Array.isArray(body) ? body[0] : body;
  return prize?.laureates ?? [];
}

async function main() {
  const prizes: Prize[] = JSON.parse(readFileSync(FILE, "utf8"));
  const cache = new Map<string, ApiLaureate[]>();
  let changed = 0;

  for (const p of prizes) {
    const key = `${p.category}/${p.year}`;
    if (!cache.has(key)) cache.set(key, await fetchPrize(p.category, p.year));
    let laureates = cache.get(key)!;

    const isSplit = p.id.split("-").length > 2;
    if (isSplit) {
      const wanted = new Set(p.laureates.map(surname));
      laureates = laureates.filter((l) => wanted.has(surname(l.knownName?.en ?? l.fullName?.en ?? "")));
      if (laureates.length === 0) throw new Error(`${p.id}: 일치하는 수상자를 찾지 못함 (${p.laureates.join(", ")})`);
    }

    const names = laureates.map((l) => l.knownName?.en ?? l.orgName?.en ?? l.fullName?.en ?? "?");
    const motivations = [...new Set(laureates.map((l) => l.motivation?.en).filter(Boolean))] as string[];
    if (motivations.length !== 1) {
      throw new Error(`${p.id}: 수상 사유가 ${motivations.length}개입니다. ID를 나누세요.\n  ${motivations.join("\n  ")}`);
    }
    const motivationEn = motivations[0];

    if (JSON.stringify(names) !== JSON.stringify(p.laureates) || motivationEn !== p.motivationEn) {
      console.log(`✎ ${p.id}`);
      if (JSON.stringify(names) !== JSON.stringify(p.laureates)) console.log(`   laureates: ${p.laureates.join(", ")} → ${names.join(", ")}`);
      if (motivationEn !== p.motivationEn) console.log(`   motivation: ${p.motivationEn}\n            → ${motivationEn}`);
      p.laureates = names;
      p.motivationEn = motivationEn;
      changed++;
    } else {
      console.log(`✓ ${p.id}`);
    }
  }

  writeFileSync(FILE, JSON.stringify(prizes, null, 2) + "\n");
  console.log(`\n${prizes.length}개 확인, ${changed}개 갱신 → ${FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
