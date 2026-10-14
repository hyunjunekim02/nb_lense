import { useState } from "react";
import { DEBUG, NEURAL_NET_PRIZE_ID } from "../config";
import { OBJECTS } from "../data";
import { filterByObject } from "../lib/mapping";
import { TIERS } from "../lib/collection";
import type { Milestone, ScanResult } from "../types";
import { ObjectChip } from "../components/ObjectChip";
import { PrizeCard } from "../components/PrizeCard";
import { Disclaimer } from "../components/Disclaimer";
import { Icon } from "../components/Icon";
import { DebugPanel } from "../components/DebugPanel";

/** 빈 결과 안내에 쓰는 인식 가능한 사물 이름 */
const AUTO_NAMES = OBJECTS.filter((o) => o.cocoClass).map((o) => o.nameKo).join(", ");

const MILESTONE_TEXT: Record<Milestone, string> = {
  first: "첫 노벨상을 찾았어요!",
  half: "1차 도감 절반을 채웠어요",
  complete: "도감 완성! 2차 도감이 열렸어요",
};

function formatSeconds(ms: number) {
  const s = ms / 1000;
  return `${s < 0.1 ? s.toFixed(2) : s.toFixed(1)}초`;
}

export function Result({
  result,
  onOpenPrize,
  onAgain,
  onShare,
  sharing,
  onOpenCollection,
  onShareCollection,
  onPlaceholderTap,
}: {
  result: ScanResult;
  onOpenPrize: (prizeId: string) => void;
  onAgain: () => void;
  onShare: () => void;
  sharing: boolean;
  onOpenCollection: () => void;
  onShareCollection: () => void;
  /** 준비 중인 3단계(AI로 더 찾기)를 눌렀을 때. 수요 측정용 */
  onPlaceholderTap: () => void;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const toggle = (id: string) => setFocus((cur) => (cur === id ? null : id));

  const empty = result.prizes.length === 0;
  const collected = result.collected;
  const newIds = new Set(collected?.newPrizeIds);
  const showBanner = !!collected && (newIds.size > 0 || !!collected.milestone);
  const hits = filterByObject(result.prizes, focus);
  const objectIds = new Set(result.objects.map((o) => o.id));
  // 사물별로 가장 점수가 높은 박스 하나만 표시한다
  const boxes = result.detections
    .filter((d) => result.objects.some((o) => o.cocoClass === d.cocoClass))
    .sort((a, b) => b.score - a.score)
    .filter((d, i, arr) => arr.findIndex((x) => x.cocoClass === d.cocoClass) === i)
    .map((d) => ({ d, obj: result.objects.find((o) => o.cocoClass === d.cocoClass)! }))
    .filter(({ obj }) => objectIds.has(obj.id));

  const photo = result.imageUrl && (
    <div className="photo result-photo">
      <div className="photo__frame">
        <img src={result.imageUrl} alt="분석한 사진" />
        {boxes.map(({ d, obj }) => (
          <button
            key={obj.id}
            type="button"
            className="box"
            aria-pressed={focus === obj.id}
            aria-label={`${obj.nameKo} 카드만 보기`}
            onClick={() => toggle(obj.id)}
            style={{
              left: `${d.box.x * 100}%`,
              top: `${d.box.y * 100}%`,
              width: `${d.box.width * 100}%`,
              height: `${d.box.height * 100}%`,
            }}
          >
            <span className="box__label">{obj.nameKo}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (empty) {
    return (
      <main className="page">
        <header className="topbar">
          <button type="button" className="btn btn--icon" onClick={onAgain} aria-label="홈으로">
            <Icon name="ui-arrow-left" />
          </button>
          <span className="topbar__title">사진 속 노벨상</span>
        </header>
        {photo}
        <div className="empty">
          <h1 className="headline" aria-live="polite">
            아직 노벨상을 찾지 못했어요
          </h1>
          <p className="lead">물건이 밝고 선명하게 보이는 사진으로 다시 시도해 주세요.</p>
          <details className="supported-objects">
            <summary>어떤 물건을 찾을 수 있나요?</summary>
            <p className="sub">{AUTO_NAMES}</p>
          </details>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={onAgain}>
              다른 사진 선택하기
            </button>
            {/* 3단계(서버 AI) 자리. 눌러도 동작하지 않지만 수요를 재기 위해 탭은 기록한다 */}
            <button type="button" className="btn btn--secondary" aria-disabled="true" onClick={onPlaceholderTap}>
              AI로 더 찾기 · 준비 중
            </button>
          </div>
          {DEBUG && result.rawDetections && (
            <DebugPanel detections={result.rawDetections} inferenceMs={result.inferenceMs} />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page page--with-bar">
      <header className="topbar">
        <button type="button" className="btn btn--icon" onClick={onAgain} aria-label="홈으로">
          <Icon name="ui-arrow-left" />
        </button>
        <span className="topbar__title">사진 속 노벨상</span>
      </header>
      <div className="result-head">
        <h1 className="headline" aria-live="polite">
          노벨상 <span className="num">{result.prizes.length}</span>개를 발견했어요
        </h1>
        {showBanner && (
          <div className="banner" role="status">
            <div className="banner__text">
              <strong>{collected.milestone ? MILESTONE_TEXT[collected.milestone] : `도감에 ${newIds.size}개 추가`}</strong>
              <span className="num">
                {collected.milestone && newIds.size > 0 ? `도감에 ${newIds.size}개 추가 · ` : ""}
                {TIERS.stage1.length}개 중 {collected.count}개
              </span>
            </div>
            {collected.milestone === "complete" ? (
              <button type="button" className="btn btn--primary banner__action" onClick={onShareCollection} disabled={sharing}>
                {sharing ? "공유 준비 중…" : "도감 공유하기"}
              </button>
            ) : (
              <button type="button" className="btn btn--text banner__action" onClick={onOpenCollection}>
                도감 보기
              </button>
            )}
          </div>
        )}
        {result.source === "sample" && (
          <p className="sub sample-note">예시 체험이에요. 내 사진으로 찾으면 도감에 모을 수 있어요.</p>
        )}
      </div>

      {photo}

      {result.objects.length > 1 && <p className="sub filter-hint">물건을 누르면 연결된 연구만 볼 수 있어요.</p>}
      <div className="chips" role="group" aria-label="찾은 물건 (누르면 해당 카드만 보기)">
        {result.objects.map((o) => (
          <ObjectChip key={o.id} object={o} selected={focus === o.id} onToggle={() => toggle(o.id)} />
        ))}
      </div>

      <ul className="cards">
        {hits.map((hit) => (
          <PrizeCard
            key={hit.prize.id}
            hit={hit}
            focusObjectId={focus}
            showObjectName={result.objects.length > 1}
            isNew={newIds.has(hit.prize.id)}
            onOpen={() => onOpenPrize(hit.prize.id)}
          />
        ))}
      </ul>

      <div className="result-foot">
        <p className="sub">
          사진을 분석하는 인공신경망도 노벨상 연구와 연결돼 있어요.{" "}
          <button
            type="button"
            className="btn btn--text"
            style={{ padding: 0, minHeight: 0 }}
            onClick={() => onOpenPrize(NEURAL_NET_PRIZE_ID)}
          >
            2024년 물리학상 보기
          </button>
        </p>
        {result.inferenceMs != null && (
          <span className="badge">
            기기 안에서 분석 · {formatSeconds(result.inferenceMs)}
          </span>
        )}
        {DEBUG && result.rawDetections && (
          <DebugPanel detections={result.rawDetections} inferenceMs={result.inferenceMs} />
        )}
        <div style={{ marginTop: 20 }}>
          <Disclaimer />
        </div>
      </div>

      <div className="bottom-bar">
        <div className="bottom-bar__inner">
          <button type="button" className="btn btn--secondary" onClick={onAgain}>
            다른 사진
          </button>
          <button type="button" className="btn btn--primary" style={{ flex: 1, width: "auto" }} onClick={onShare} disabled={sharing}>
            <Icon name="ui-share" small />
            {sharing ? "공유 준비 중…" : "결과 공유하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
