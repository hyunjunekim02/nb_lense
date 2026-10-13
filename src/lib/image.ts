import { DETECTOR } from "../config";

export class ImageDecodeError extends Error {}

export type PreparedImage = {
  /** 추론에 넣을 캔버스 (긴 변 최대 DETECTOR.maxImageSide, EXIF 회전 반영) */
  canvas: HTMLCanvasElement;
  /** 화면 표시용 object URL (canvas와 같은 방향·비율) */
  url: string;
};

/**
 * 사진 파일을 디코딩해 EXIF 회전을 반영하고 긴 변 기준으로 축소한다.
 * HEIC처럼 브라우저가 열 수 없는 형식이면 ImageDecodeError를 던진다.
 */
export async function prepareImage(file: Blob, maxSide: number = DETECTOR.maxImageSide): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    throw new ImageDecodeError(String(err));
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageDecodeError("canvas 2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new ImageDecodeError("toBlob failed");
  return { canvas, url: URL.createObjectURL(blob) };
}

/** 브라우저가 화면을 실제로 그릴 때까지 기다린다 (동기 추론 전에 분석 중 화면을 먼저 보여주기 위해) */
export function nextPaint(frames = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => (n <= 0 ? resolve() : requestAnimationFrame(() => step(n - 1)));
    step(frames);
  });
}
