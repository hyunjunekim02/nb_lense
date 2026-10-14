import { useCallback, useEffect, useRef, useState } from "react";
import { OBJECTS, PRIZE_BY_ID } from "./data";
import { objectsFromRecognitions, prizesForObjects } from "./lib/mapping";
import { ImageDecodeError, nextPaint, prepareImage } from "./lib/image";
import { pipeline } from "./lib/recognizers/pipeline";
import { usableDetections } from "./lib/recognizers/coco";
import { track } from "./lib/analytics";
import { renderCollectionCard, renderShareCard, shareOrDownload } from "./lib/shareCard";
import * as collection from "./lib/collection";
import type { Detection, ScanResult, ScanSource } from "./types";
import { Home } from "./screens/Home";
import { Analyzing } from "./screens/Analyzing";
import { Result } from "./screens/Result";
import { Collection } from "./screens/Collection";
import { About } from "./screens/About";
import { Review } from "./screens/Review";
import { Message } from "./screens/Message";
import { PrizeSheet } from "./components/PrizeSheet";

type Screen =
  | { name: "home" }
  | { name: "analyzing"; imageUrl: string; phase: "model" | "detect" }
  | { name: "result" }
  | { name: "collection" }
  | { name: "about" }
  | { name: "review" }
  | { name: "error"; kind: "model" | "decode" };

const catalog = { objects: OBJECTS, prizeById: PRIZE_BY_ID };
const initialCollection = collection.load();

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [record, setRecord] = useState(initialCollection.state);
  const persistent = initialCollection.persistent;
  const recordRef = useRef(record);
  recordRef.current = record;
  const resultRef = useRef(result);
  resultRef.current = result;
  /** 모델 로드 실패 시 "다시 시도"에 쓸 원본 */
  const pending = useRef<{ blob: Blob; source: ScanSource } | null>(null);
  /** 진행 중인 스캔. 사용자가 뒤로 가면 결과를 버린다 */
  const scanId = useRef(0);

  const updateRecord = useCallback((next: collection.CollectionState) => {
    setRecord(next);
    recordRef.current = next;
    collection.save(next);
  }, []);

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
      if (name === "about" || name === "collection" || (name === "result" && resultRef.current)) {
        setScreen({ name } as Screen);
      } else {
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

      const needsModel = !pipeline.isReady();
      go({ name: "analyzing", imageUrl: prepared.url, phase: needsModel ? "model" : "detect" }, isRetry);

      try {
        await pipeline.load();
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
      const { recognitions, ms, raw } = await pipeline.run(prepared.canvas);
      if (id !== scanId.current) return;

      // 박스 표시와 ?debug 점수표는 1단계(COCO) 원본을 쓴다
      const rawDetections = (raw.coco as Detection[] | undefined) ?? [];
      const objects = objectsFromRecognitions(recognitions, catalog);
      const prizes = prizesForObjects(objects, catalog);
      if (prizes.length > 0) track({ name: "scan_success", objects: objects.length, prizes: prizes.length, ms });
      else track({ name: "scan_empty" });

      let collected: ScanResult["collected"];
      if (source === "upload") {
        const applied = collection.applyScan(recordRef.current, { source, objects, prizes });
        updateRecord(applied.state);
        const count = collection.progress(applied.state).prizes;
        collected = { newPrizeIds: applied.newPrizeIds, milestone: collection.topMilestone(applied.milestones), count };
        for (const prizeId of applied.newPrizeIds) track({ name: "collect_new", prizeId });
        for (const milestone of applied.milestones) track({ name: "milestone", milestone });
        track({ name: "collection_progress", count });
      }

      pending.current = null;
      setResult({
        source,
        objects,
        prizes,
        detections: usableDetections(rawDetections),
        rawDetections,
        imageUrl: prepared.url,
        inferenceMs: ms,
        collected,
      });
      go({ name: "result" }, true);
    },
    [go, updateRecord],
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

  const openPrize = useCallback(
    (prizeId: string) => {
      track({ name: "prize_open", prizeId });
      if (screen.name === "collection" && collection.tierOf(prizeId) === 2) {
        track({ name: "stage_placeholder_tap", stage: "zeroshot" });
      }
      setSheet(prizeId);
      history.pushState({ screen: screen.name, sheet: prizeId }, "");
    },
    [screen.name],
  );

  const closeSheet = useCallback(() => history.back(), []);

  const share = useCallback(async (render: (url: string) => Promise<Blob>, filename: string) => {
    setSharing(true);
    try {
      const url = location.origin + location.pathname;
      const method = await shareOrDownload(await render(url), filename, url);
      return method;
    } catch (err) {
      console.warn(err);
      return "cancel" as const;
    } finally {
      setSharing(false);
    }
  }, []);

  const onShare = useCallback(async () => {
    if (!result) return;
    const method = await share((url) => renderShareCard(result, url), "nobel-lens.png");
    if (method !== "cancel") track({ name: "share", method });
  }, [result, share]);

  const onShareCollection = useCallback(async () => {
    const found = collection.TIERS.stage1.filter((id) => recordRef.current.prizes[id]).map((id) => PRIZE_BY_ID.get(id)!);
    const method = await share(
      (url) => renderCollectionCard(found, collection.TIERS.stage1.length, url),
      "nobel-lens-collection.png",
    );
    if (method !== "cancel") track({ name: "collection_share", method });
  }, [share]);

  const openCollection = useCallback(() => {
    track({ name: "collection_open" });
    go({ name: "collection" });
  }, [go]);

  const home = () => go({ name: "home" });

  let view;
  switch (screen.name) {
    case "home":
      view = (
        <Home
          onFile={(f) => runScan(f, "upload")}
          onSample={onSample}
          onAbout={() => go({ name: "about" })}
          onCollection={openCollection}
          collected={collection.progress(record).prizes}
          collectionTotal={collection.TIERS.stage1.length}
        />
      );
      break;
    case "analyzing":
      view = <Analyzing key={screen.imageUrl} imageUrl={screen.imageUrl} phase={screen.phase} />;
      break;
    case "result":
      view = result ? (
        <Result
          result={result}
          onOpenPrize={openPrize}
          onAgain={home}
          onShare={onShare}
          sharing={sharing}
          onOpenCollection={openCollection}
          onShareCollection={onShareCollection}
          onPlaceholderTap={() => track({ name: "stage_placeholder_tap", stage: "llm" })}
        />
      ) : null;
      break;
    case "collection":
      view = (
        <Collection
          state={record}
          persistent={persistent}
          onBack={() => history.back()}
          onOpenPrize={openPrize}
          onShare={onShareCollection}
          sharing={sharing}
          onReset={() => {
            track({ name: "collection_reset" });
            updateRecord(collection.reset(recordRef.current));
          }}
          onDismissInstallHint={() =>
            updateRecord({ ...recordRef.current, ui: { ...recordRef.current.ui, installHintDismissed: true } })
          }
        />
      );
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
  let sheetView = null;
  if (sheet && sheetPrize && screen.name === "result") {
    const where = result?.prizes.find((h) => h.prize.id === sheet)?.where ?? [];
    sheetView = <PrizeSheet prize={sheetPrize} where={where} onClose={closeSheet} />;
  } else if (sheet && sheetPrize && screen.name === "collection") {
    // 도감에서는 찾은 칸과 2차 칸만 열린다. 2차는 읽기 전용 안내를 붙인다
    const stage2 = collection.tierOf(sheet) === 2;
    sheetView = (
      <PrizeSheet
        prize={sheetPrize}
        where={collection.whereFor(sheet)}
        notice={stage2 ? "이 노벨상을 사진으로 찾는 기능은 준비 중이에요." : undefined}
        onClose={closeSheet}
      />
    );
  }

  return (
    <>
      {view}
      {sheetView}
    </>
  );
}
