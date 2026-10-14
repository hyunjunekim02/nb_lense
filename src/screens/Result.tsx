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
  stage2: "2차 도감이 열렸어요 · 서비스 준비 중",
  complete: "1차 도감을 완성했어요",
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
        <div style={{ paddingTop: 20 }}>{photo}</div>
        <div className="empty">
          <h1 className="headline" aria-live="polite">
            이 사진에서는 찾지 못했어요
          </h1>
          <p className="lead">찾을 수 있는 것: {AUTO_NAMES}. 이 중 하나가 잘 보이게 다시 찍어 보세요.</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={onAgain}>
              다른 사진으로 해보기
            </button>
            {/* 3단계(서버 AI) 자리. 눌러도 동작하지 않지만 수요를 재기 위해 탭은 기록한다 */}
            <button type="button" className="btn btn--secondary" aria-disabled="true" onClick={onPlaceholderTap}>
              AI로 더 찾기 · 서비스 준비 중
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
      <div className="result-head">
        <h1 className="headline" aria-live="polite">
          이 사진에서 노벨상 <span className="num">{result.prizes.length}</span>개를
          찾았어요
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
                도감 공유하기
              </button>
            ) : (
              <button type="button" className="btn btn--text banner__action" onClick={onOpenCollection}>
                도감 보기
              </button>
            )}
          </div>
        )}
        {result.source === "sample" && (
          <p className="sub sample-note">예시 사진 결과는 도감에 담기지 않아요. 직접 찍어서 모아 보세요.</p>
        )}
      </div>

      {photo}

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
        <p>
          이 렌즈의 인식 모델도 인공신경망입니다. 2024년 노벨 물리학상이 그 기초를 놓았어요.{" "}
          <button
            type="button"
            className="btn btn--text"
            style={{ padding: 0, minHeight: 0 }}
            onClick={() => onOpenPrize(NEURAL_NET_PRIZE_ID)}
          >
            카드 보기
          </button>
        </p>
        {result.inferenceMs != null && (
          <span className="badge">
            기기 안에서 처리됨 · {formatSeconds(result.inferenceMs)}
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
            공유하기
          </button>
        </div>
      </div>
    </main>
  );
}
