/*
 * 노벨 렌즈 서비스 워커 (v1.1 명세 8장). 이 파일은 템플릿이고, 빌드 때 vite.config.ts의 serviceWorker 플러그인이
 * __값__ 자리를 채워 dist/sw.js로 내보낸다. 개발 서버에서는 등록하지 않는다.
 *
 * - 앱 셸(HTML/JS/CSS)과 아이콘: 설치 때 미리 받아 둔다. 캐시 이름에 빌드 해시가 들어가 배포마다 새로 받는다.
 * - HTML: 네트워크 우선 (배포 갱신을 바로 반영, 오프라인이면 캐시)
 * - 모델·wasm·글꼴: 캐시 우선. 처음 쓸 때 받아 두고, MediaPipe 버전이 바뀔 때만 다시 받는다.
 */
const SHELL = "__SHELL_CACHE__";
const RUNTIME = "__RUNTIME_CACHE__";
const BASE = "__BASE__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("nb-lense-") && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 같은 출처, 이 앱 경로 아래만 다룬다 (분석 비콘 같은 외부 요청은 건드리지 않음)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length);

  if (req.mode === "navigate") {
    // ?debug 같은 쿼리가 붙어도 같은 HTML이므로 BASE 한 곳에 저장한다
    event.respondWith(networkFirst(req, BASE));
  } else if (path.startsWith("models/") || path.startsWith("wasm/") || /\.woff2?$/.test(path)) {
    event.respondWith(cacheFirst(req, RUNTIME));
  } else if (path.startsWith("assets/") || path.startsWith("icons/") || path.startsWith("samples/")) {
    event.respondWith(cacheFirst(req, SHELL));
  } else {
    event.respondWith(networkFirst(req, req));
  }
});

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    const cache = await caches.open(cacheName);
    await cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req, key) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") {
      const cache = await caches.open(SHELL);
      await cache.put(key, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await caches.match(key);
    if (hit) return hit;
    throw err;
  }
}
