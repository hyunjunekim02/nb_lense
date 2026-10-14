/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site under /<repo>/
const BASE = "/nb_lense/";

/**
 * src/sw.template.js를 채워 dist/sw.js로 내보낸다 (v1.1 명세 8장).
 * 미리 받을 목록은 이번 빌드의 JS/CSS/HTML과 public/icons, 캐시 이름에는 빌드 해시를 넣는다.
 * 모델·wasm 캐시 이름에는 MediaPipe 버전을 넣어, wasm과 JS 번들의 버전이 어긋나지 않게 한다.
 */
function serviceWorker(): Plugin {
  return {
    name: "nb-lense-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const built = Object.keys(bundle)
        .filter((f) => /\.(js|css|html)$/.test(f))
        .sort();
      const hash = createHash("sha256");
      for (const f of built) {
        const item = bundle[f];
        hash.update(f).update(item.type === "chunk" ? item.code : String(item.source));
      }
      const icons = readdirSync("public/icons").map((f) => `icons/${f}`);
      const extra = ["manifest.webmanifest", "app-icon-192.png", "apple-touch-icon.png", "favicon-32.png"];
      const precache = [BASE, ...built.filter((f) => f !== "index.html"), ...icons, ...extra].map((f) =>
        f === BASE ? f : BASE + f,
      );
      const pkg = JSON.parse(readFileSync("package.json", "utf8"));
      const mediapipe = pkg.dependencies["@mediapipe/tasks-vision"];

      const source = readFileSync("src/sw.template.js", "utf8")
        .replace("__SHELL_CACHE__", `nb-lense-shell-${hash.digest("hex").slice(0, 10)}`)
        .replace("__RUNTIME_CACHE__", `nb-lense-runtime-mp${mediapipe}`)
        .replace("__BASE__", BASE)
        .replace("__PRECACHE__", JSON.stringify(precache));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), serviceWorker()],
  server: {
    // npm run dev 하면 브라우저가 /nb_lense/ 경로로 바로 열린다
    open: true,
  },
  build: {
    target: ["es2020", "safari16"],
  },
  test: {
    environment: "node",
  },
});
