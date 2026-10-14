// 홈 화면 추가용 앱 아이콘(PNG)을 만든다. 외부 도구 없이 node 내장 zlib로 그린다.
//   node scripts/make-icons.mjs
// 디자인: 강조색 배경 + 흰 렌즈 고리와 가운데 점. 메달·금색은 쓰지 않는다(명세 원칙).
// maskable 아이콘으로도 쓰므로 그림은 가운데 60% 안전 영역 안에 둔다.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const ACCENT = [0x1f, 0x5f, 0xd1];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** 이 점이 흰 그림 안에 있는가 (좌표는 0~1) */
function inside(x, y) {
  const d = Math.hypot(x - 0.5, y - 0.5);
  return (d >= 0.2 && d <= 0.28) || d <= 0.075;
}

function png(size) {
  const SS = 4; // 가장자리 부드럽게: 픽셀당 4×4 표본
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) if (inside((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)) hit++;
      const a = hit / (SS * SS);
      for (let ch = 0; ch < 3; ch++) row[1 + px * 3 + ch] = Math.round(ACCENT[ch] * (1 - a) + WHITE[ch] * a);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [file, size] of [
  ["public/app-icon-192.png", 192],
  ["public/app-icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
  ["public/favicon-32.png", 32],
]) {
  writeFileSync(file, png(size));
  console.log(`✓ ${file}`);
}
