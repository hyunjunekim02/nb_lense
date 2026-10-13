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
