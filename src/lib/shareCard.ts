import { SERVICE_NAME } from "../config";
import type { ScanResult } from "../types";

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

/** 결과 공유 카드 1080×1350 PNG (명세 2.2·8장). 외부 라이브러리 없이 canvas로 그린다. */
export async function renderShareCard(result: ScanResult, url: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = readToken("--bg", "#ffffff");
  const text = readToken("--text", "#16181d");
  const sub = readToken("--text-sub", "#5b6170");
  const line = readToken("--line", "#e3e5ea");
  const accent = readToken("--accent", "#1f5fd1");
  const font = readToken("--font", "sans-serif");

  try {
    await document.fonts.load(`700 40px ${font}`);
    await document.fonts.load(`400 40px ${font}`);
  } catch {
    // 글꼴을 못 불러와도 시스템 글꼴로 그린다
  }

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";

  let y = PAD;
  ctx.fillStyle = accent;
  ctx.font = `600 34px ${font}`;
  ctx.fillText(SERVICE_NAME, PAD, y);
  y += 70;

  ctx.fillStyle = text;
  ctx.font = `700 64px ${font}`;
  const n = result.prizes.length;
  const lead = result.source === "manual" ? "고른 물건에서" : "이 사진에서";
  ctx.fillText(lead, PAD, y);
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

  const footerTop = H - PAD - 70;
  const rowH = 96;
  const maxRows = Math.max(1, Math.floor((footerTop - y - 20) / rowH));
  const rows = result.prizes.slice(0, n > maxRows ? maxRows - 1 : maxRows);
  for (const hit of rows) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.fillStyle = sub;
    ctx.font = `400 28px ${font}`;
    ctx.fillText(`${hit.prize.year} · ${hit.prize.categoryKo}`, PAD, y + 16);
    ctx.fillStyle = text;
    ctx.font = `600 36px ${font}`;
    ctx.fillText(hit.prize.titleKo, PAD, y + 50);
    y += rowH;
  }
  if (rows.length < n) {
    ctx.fillStyle = sub;
    ctx.font = `400 30px ${font}`;
    ctx.fillText(`외 ${n - rows.length}개`, PAD, y + 20);
  }

  ctx.fillStyle = sub;
  ctx.font = `400 26px ${font}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), PAD, footerTop);
  ctx.fillText("비공식 학생 프로젝트 · 수상 정보 출처: NobelPrize.org", PAD, footerTop + 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
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
