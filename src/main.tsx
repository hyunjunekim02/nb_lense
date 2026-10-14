import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App";
import { SERVICE_NAME } from "./config";
import { trackPageview } from "./lib/analytics";

document.title = SERVICE_NAME;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

trackPageview();

// 도감 기록이 브라우저 정리로 지워지지 않게 요청한다. 결과는 무시한다 (v1.1 명세 7장)
navigator.storage?.persist?.().catch(() => {});

// 앱 캐시: 모델이 한 번 캐시되면 오프라인에서도 스캔·도감 기록이 된다. 배포본에서만 등록한다
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn(err));
  });
}
