import { SERVICE_NAME } from "../config";
import type { PrizeEntry, ScanResult } from "../types";

const W = 1080;
const H = 1350;
const PAD = 80;

function readToken(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 줄바꿈하며 텍스트를 그리고, 마지막 줄 아래 y를 돌려준다 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++;
      if (lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

/** 공유 카드 공통: 캔버스·색·글꼴을 준비하고 맨 위에 서비스명을 그린다 */
async function startCard() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const c = {
    bg: readToken("--bg", "#ffffff"),
    text: readToken("--text", "#16181d"),
    sub: readToken("--text-sub", "#5b6170"),
    line: readToken("--line", "#e3e5ea"),
    accent: readToken("--accent", "#1f5fd1"),
    font: readToken("--font", "sans-serif"),
  };

  try {
    await document.fonts.load(`700 40px ${c.font}`);
    await document.fonts.load(`400 40px ${c.font}`);
  } catch {
    // 글꼴을 못 불러와도 시스템 글꼴로 그린다
  }

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";
  ctx.fillStyle = c.accent;
  ctx.font = `600 34px ${c.font}`;
  ctx.fillText(SERVICE_NAME, PAD, PAD);
  return { canvas, ctx, c, y: PAD + 70, footerTop: H - PAD - 70 };
}

type Card = Awaited<ReturnType<typeof startCard>>;

/** 노벨상 목록 (연도 · 부문 / 제목). 넘치면 "외 n개" */
function drawPrizeRows({ ctx, c, footerTop }: Card, prizes: PrizeEntry[], y: number) {
  const n = prizes.length;
  const rowH = 96;
  const maxRows = Math.max(1, Math.floor((footerTop - y - 20) / rowH));
  const rows = prizes.slice(0, n > maxRows ? maxRows - 1 : maxRows);
  for (const prize of rows) {
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.fillStyle = c.sub;
    ctx.font = `400 28px ${c.font}`;
    ctx.fillText(`${prize.year} · ${prize.categoryKo}`, PAD, y + 16);
    ctx.fillStyle = c.text;
    ctx.font = `600 36px ${c.font}`;
    ctx.fillText(prize.titleKo, PAD, y + 50);
    y += rowH;
  }
  if (rows.length < n) {
    ctx.fillStyle = c.sub;
    ctx.font = `400 30px ${c.font}`;
    ctx.fillText(`외 ${n - rows.length}개`, PAD, y + 20);
  }
}

/** 하단 URL + 비공식 고지, PNG로 내보내기 */
function finishCard({ canvas, ctx, c, footerTop }: Card, url: string): Promise<Blob> {
  ctx.fillStyle = c.sub;
  ctx.font = `400 26px ${c.font}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), PAD, footerTop);
  ctx.fillText("비공식 학생 프로젝트 · 수상 정보 출처: NobelPrize.org", PAD, footerTop + 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

/** 결과 공유 카드 1080×1350 PNG (명세 2.2·8장). 외부 라이브러리 없이 canvas로 그린다. */
export async function renderShareCard(result: ScanResult, url: string): Promise<Blob> {
  const card = await startCard();
  const { ctx, c } = card;
  const { text, sub, font } = c;
  let { y } = card;

  ctx.fillStyle = text;
  ctx.font = `700 64px ${font}`;
  const n = result.prizes.length;
  ctx.fillText("이 사진에서", PAD, y);
  y += 84;
  ctx.fillText(`노벨상 ${n}개를 찾았어요`, PAD, y);
  y += 110;

  if (result.imageUrl) {
    const img = await loadImage(result.imageUrl);
    const boxW = W - PAD * 2;
    const boxH = 420;
    const scale = Math.max(boxW / img.width, boxH / img.height);
    const sw = boxW / scale;
    const sh = boxH / scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, y, boxW, boxH, 24);
    ctx.clip();
    // 세로로 긴 사진은 위쪽을 조금 더 남긴다 (인물·사물이 주로 위에 있음)
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.3, sw, sh, PAD, y, boxW, boxH);
    ctx.restore();
    y += boxH + 48;
  } else {
    ctx.fillStyle = sub;
    ctx.font = `400 36px ${font}`;
    y = wrapText(ctx, result.objects.map((o) => o.nameKo).join(" · "), PAD, y, W - PAD * 2, 50) + 30;
  }

  drawPrizeRows(card, result.prizes.map((h) => h.prize), y);
  return finishCard(card, url);
}

/** 도감 공유 카드 (v1.1 명세 4.4). 사진은 저장하지 않으므로 넣지 않는다 */
export async function renderCollectionCard(found: PrizeEntry[], total: number, url: string): Promise<Blob> {
  const card = await startCard();
  const { ctx, c } = card;
  let { y } = card;

  ctx.fillStyle = c.text;
  ctx.font = `700 64px ${c.font}`;
  ctx.fillText(`노벨상 ${total}개 중`, PAD, y);
  y += 84;
  ctx.fillText(`${found.length}개를 찾았어요`, PAD, y);
  y += 110;

  const barW = W - PAD * 2;
  ctx.fillStyle = c.line;
  ctx.beginPath();
  ctx.roundRect(PAD, y, barW, 16, 8);
  ctx.fill();
  if (found.length > 0) {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.roundRect(PAD, y, Math.max(16, (barW * found.length) / Math.max(1, total)), 16, 8);
    ctx.fill();
  }
  y += 16 + 64;

  drawPrizeRows(card, found, y);
  return finishCard(card, url);
}

/** 공유 시트가 파일 공유를 지원하면 공유하고, 아니면 PNG를 내려받는다 */
export async function shareOrDownload(blob: Blob, filename: string, url: string): Promise<"share" | "download" | "cancel"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: SERVICE_NAME, url });
      return "share";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancel";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "download";
}
