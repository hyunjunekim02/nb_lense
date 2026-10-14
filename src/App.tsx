import { useCallback, useEffect, useRef, useState } from "react";
import { COCO_ALLOWLIST, OBJECTS, PRIZE_BY_ID } from "./data";
import { SCORE_THRESHOLD } from "./config";
import { objectsFromDetections, prizesForObjects } from "./lib/mapping";
import { ImageDecodeError, nextPaint, prepareImage } from "./lib/image";
import { detect, isDetectorReady, loadDetector } from "./lib/detector";
import { track } from "./lib/analytics";
import { renderShareCard, shareOrDownload } from "./lib/shareCard";
import type { ScanResult, ScanSource } from "./types";
import { Home } from "./screens/Home";
import { Analyzing } from "./screens/Analyzing";
import { Result } from "./screens/Result";
import { About } from "./screens/About";
import { Review } from "./screens/Review";
import { Message } from "./screens/Message";
import { PrizeSheet } from "./components/PrizeSheet";

type Screen =
  | { name: "home" }
  | { name: "analyzing"; imageUrl: string; phase: "model" | "detect" }
  | { name: "result" }
  | { name: "about" }
  | { name: "review" }
  | { name: "error"; kind: "model" | "decode" };

const catalog = { objects: OBJECTS, prizeById: PRIZE_BY_ID };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const resultRef = useRef(result);
  resultRef.current = result;
  /** 모델 로드 실패 시 "다시 시도"에 쓸 원본 */
  const pending = useRef<{ blob: Blob; source: ScanSource } | null>(null);
  /** 진행 중인 스캔. 사용자가 뒤로 가면 결과를 버린다 */
  const scanId = useRef(0);

  // 휴대폰 뒤로 가기: 시트가 열려 있으면 닫고, 아니면 이전 화면으로
  const go = useCallback((next: Screen, replace = false) => {
    setScreen(next);
    setSheet(null);
    const state = { screen: next.name };
    if (replace) history.replaceState(state, "");
    else history.pushState(state, "");
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // #review: 팀 검수용 전체 문구 보기 (메뉴에는 노출하지 않음)
    if (location.hash === "#review") setScreen({ name: "review" });
    history.replaceState({ screen: "home" }, "");
    const onPop = (e: PopStateEvent) => {
      const name = (e.state?.screen as Screen["name"] | undefined) ?? "home";
      const sheetId = (e.state?.sheet as string | undefined) ?? null;
      setSheet(sheetId);
      if (name === "about" || (name === "result" && resultRef.current)) setScreen({ name } as Screen);
      else {
        scanId.current++;
        setScreen({ name: "home" });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const runScan = useCallback(
    async (blob: Blob, source: ScanSource, isRetry = false) => {
      const id = ++scanId.current;
      if (!isRetry) track({ name: "scan_start", source });
      pending.current = { blob, source };

      let prepared;
      try {
        prepared = await prepareImage(blob);
      } catch (err) {
        if (id !== scanId.current) return;
        console.warn(err);
        go({ name: "error", kind: err instanceof ImageDecodeError ? "decode" : "model" }, isRetry);
        return;
      }
      if (id !== scanId.current) return;

      const needsModel = !isDetectorReady();
      go({ name: "analyzing", imageUrl: prepared.url, phase: needsModel ? "model" : "detect" }, isRetry);

      try {
        await loadDetector();
      } catch (err) {
        console.warn(err);
        if (id !== scanId.current) return;
        track({ name: "model_load_fail" });
        go({ name: "error", kind: "model" }, true);
        return;
      }
      if (id !== scanId.current) return;
      if (needsModel) setScreen({ name: "analyzing", imageUrl: prepared.url, phase: "detect" });

      // detect()는 동기라 UI를 막는다. 분석 중 화면이 그려진 뒤 호출한다 (명세 5.1)
      await nextPaint(2);
      const { detections, ms } = await detect(prepared.canvas);
      if (id !== scanId.current) return;

      // 디버그 모드에서는 모델이 임계값 아래·허용 목록 밖 결과까지 주므로 여기서 거른다
      const used = detections.filter((d) => d.score >= SCORE_THRESHOLD && COCO_ALLOWLIST.includes(d.cocoClass));
      const objects = objectsFromDetections(used, catalog);
      const prizes = prizesForObjects(objects, catalog);
      if (prizes.length > 0) track({ name: "scan_success", objects: objects.length, prizes: prizes.length, ms });
      else track({ name: "scan_empty" });

      pending.current = null;
      setResult({ source, objects, prizes, detections: used, rawDetections: detections, imageUrl: prepared.url, inferenceMs: ms });
      go({ name: "result" }, true);
    },
    [go],
  );

  const onSample = useCallback(
    async (src: string) => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await runScan(await res.blob(), "sample");
      } catch (err) {
        console.warn(err);
        go({ name: "error", kind: "model" });
      }
    },
    [go, runScan],
  );

  const openPrize = useCallback((prizeId: string) => {
    track({ name: "prize_open", prizeId });
    setSheet(prizeId);
    history.pushState({ screen: "result", sheet: prizeId }, "");
  }, []);

  const closeSheet = useCallback(() => history.back(), []);

  const onShare = useCallback(async () => {
    if (!result) return;
    setSharing(true);
    try {
      const url = location.origin + location.pathname;
      const blob = await renderShareCard(result, url);
      const method = await shareOrDownload(blob, "nobel-lens.png", url);
      if (method !== "cancel") track({ name: "share", method });
    } catch (err) {
      console.warn(err);
    } finally {
      setSharing(false);
    }
  }, [result]);

  const home = () => go({ name: "home" });

  let view;
  switch (screen.name) {
    case "home":
      view = (
        <Home
          onFile={(f) => runScan(f, "upload")}
          onSample={onSample}
          onAbout={() => go({ name: "about" })}
        />
      );
      break;
    case "analyzing":
      view = <Analyzing key={screen.imageUrl} imageUrl={screen.imageUrl} phase={screen.phase} />;
      break;
    case "result":
      view = result ? (
        <Result result={result} onOpenPrize={openPrize} onAgain={home} onShare={onShare} sharing={sharing} />
      ) : null;
      break;
    case "about":
      view = <About onBack={() => history.back()} />;
      break;
    case "review":
      view = <Review />;
      break;
    case "error":
      view =
        screen.kind === "decode" ? (
          <Message title="이 사진 형식은 열 수 없어요. JPG나 PNG로 시도해 주세요">
            <button type="button" className="btn btn--primary" onClick={home}>
              홈으로
            </button>
          </Message>
        ) : (
          <Message title="인식 모델을 불러오지 못했어요">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => pending.current && runScan(pending.current.blob, pending.current.source, true)}
              disabled={!pending.current}
            >
              다시 시도
            </button>
            <button type="button" className="btn btn--secondary" onClick={home}>
              홈으로
            </button>
          </Message>
        );
      break;
  }

  const sheetPrize = sheet ? PRIZE_BY_ID.get(sheet) : undefined;
  const sheetWhere = (sheet && result?.prizes.find((h) => h.prize.id === sheet)?.where) || [];

  return (
    <>
      {view}
      {sheetPrize && screen.name === "result" && (
        <PrizeSheet prize={sheetPrize} where={sheetWhere} onClose={closeSheet} />
      )}
    </>
  );
}
