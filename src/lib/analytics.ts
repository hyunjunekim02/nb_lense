import { GOATCOUNTER_CODE } from "../config";

/**
 * 쿠키 없는 경량 분석(GoatCounter). 사진·인식 이미지·위치 정보는 어떤 경우에도 보내지 않는다.
 * 이벤트는 GoatCounter 대시보드에서 경로로 집계되므로, 나눠 보고 싶은 값은 경로에, 세부 값은 제목에 넣는다.
 */
export type AnalyticsEvent =
  | { name: "scan_start"; source: "upload" | "sample" }
  | { name: "scan_success"; objects: number; prizes: number; ms?: number }
  | { name: "scan_empty" }
  | { name: "prize_open"; prizeId: string }
  | { name: "share"; method: "share" | "download" }
  | { name: "model_load_fail" };

function send(path: string, title: string, isEvent: boolean) {
  if (!GOATCOUNTER_CODE || typeof window === "undefined") return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  const params = new URLSearchParams({
    p: path,
    t: title,
    e: String(isEvent),
    s: `${screen.width},${screen.height},${Math.round(devicePixelRatio)}`,
    rnd: Math.random().toString(36).slice(2),
  });
  if (!isEvent && document.referrer) params.set("r", document.referrer);
  const url = `https://${GOATCOUNTER_CODE}.goatcounter.com/count?${params}`;
  try {
    if (!navigator.sendBeacon?.(url)) new Image().src = url;
  } catch {
    // 분석 실패는 사용자 흐름에 영향을 주지 않는다
  }
}

export function trackPageview() {
  send("/", document.title, false);
}

export function track(event: AnalyticsEvent) {
  switch (event.name) {
    case "scan_start":
      return send(`scan_start/${event.source}`, "scan_start", true);
    case "scan_success":
      return send(
        "scan_success",
        `objects=${event.objects} prizes=${event.prizes}${event.ms != null ? ` ms=${Math.round(event.ms)}` : ""}`,
        true,
      );
    case "scan_empty":
      return send("scan_empty", "scan_empty", true);
    case "prize_open":
      return send(`prize_open/${event.prizeId}`, "prize_open", true);
    case "share":
      return send(`share/${event.method}`, "share", true);
    case "model_load_fail":
      return send("model_load_fail", "model_load_fail", true);
  }
}
