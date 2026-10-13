// Copies the MediaPipe wasm runtime from the pinned npm package into public/wasm
// so it is served from the same origin as the app (no external CDN at runtime).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dest = "public/wasm";

if (!existsSync(src)) {
  console.warn(`[copy-wasm] ${src} not found, skipping`);
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
// Only the classic (non-module) SIMD / no-SIMD builds are used by FilesetResolver.forVisionTasks
for (const file of readdirSync(src)) {
  if (file.includes("module")) continue;
  cpSync(join(src, file), join(dest, file));
}
console.log(`[copy-wasm] copied MediaPipe wasm to ${dest}`);
