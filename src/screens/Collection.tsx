import { useEffect, useRef, useState } from "react";
import { STAGE2_UNLOCK_OBJECTS } from "../config";
import { OBJECTS, PRIZE_BY_ID } from "../data";
import { hintFor, progress, TIERS, type CollectionState } from "../lib/collection";
import { Icon } from "../components/Icon";

/** 2026-10-14 → "10월 14일" (올해가 아니면 연도도) */
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const md = `${m}월 ${d}일`;
  return y === new Date().getFullYear() ? md : `${y}년 ${md}`;
}

/** 노벨상 칸에 보여줄 사물 아이콘: 찾은 칸은 처음 찾은 사물, 그 밖에는 연결된 첫 사물 */
function iconFor(prizeId: string, objectId?: string) {
  const obj =
    (objectId && OBJECTS.find((o) => o.id === objectId)) ||
    OBJECTS.find((o) => o.prizes.some((l) => l.prizeId === prizeId));
  return obj?.icon;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isStandalone() {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches
  );
}

/** 내 노벨상 도감 (v1.1 명세 4.2) */
export function Collection({
  state,
  persistent,
  onBack,
  onOpenPrize,
  onShare,
  sharing,
  onReset,
  onDismissInstallHint,
}: {
  state: CollectionState;
  persistent: boolean;
  onBack: () => void;
  onOpenPrize: (prizeId: string) => void;
  onShare: () => void;
  sharing: boolean;
  onReset: () => void;
  onDismissInstallHint: () => void;
}) {
  const p = progress(state);
  const [confirming, setConfirming] = useState(false);
  const showInstallHint = persistent && !state.ui.installHintDismissed && isIosSafari() && !isStandalone();
  const complete = p.prizes === p.prizeTotal;

  return (
    <main className="page collection">
      <header className="topbar">
        <button type="button" className="btn btn--icon" onClick={onBack} aria-label="뒤로">
          <Icon name="ui-arrow-left" />
        </button>
        <h1>내 노벨상 도감</h1>
      </header>

      {!persistent && <p className="callout">이 브라우저에서는 기록을 저장할 수 없어요. 이 화면을 닫으면 기록이 사라져요.</p>}
      {showInstallHint && (
        <div className="callout callout--row">
          <span>홈 화면에 추가하면 기록이 더 오래 보관돼요</span>
          <button type="button" className="btn btn--icon" onClick={onDismissInstallHint} aria-label="안내 닫기">
            <Icon name="ui-x" small />
          </button>
        </div>
      )}

      <section className="collection__summary">
        <h2 className="headline">
          노벨상 <span className="num">{p.prizeTotal}</span>개 중 <span className="num">{p.prizes}</span>개를 찾았어요
        </h2>
        <div
          className="meter"
          role="progressbar"
          aria-label="1차 도감 진행률"
          aria-valuemin={0}
          aria-valuemax={p.prizeTotal}
          aria-valuenow={p.prizes}
        >
          <div className="meter__bar" style={{ width: `${(p.prizes / Math.max(1, p.prizeTotal)) * 100}%` }} />
        </div>
        <p className="sub num">
          사물 {p.objectTotal}종 중 {p.objects}종
        </p>
      </section>

      <h2 className="section-title">1차 도감</h2>
      <ul className="tiles">
        {TIERS.stage1.map((id) => {
          const prize = PRIZE_BY_ID.get(id)!;
          const got = state.prizes[id];
          const meta = (
            <span className="tile__meta num">
              {prize.year} · {prize.categoryKo}
            </span>
          );
          if (!got) {
            return (
              <li key={id} className="tile tile--locked">
                <span className="tile__mark" aria-hidden="true">
                  ?
                </span>
                {meta}
                <span className="visually-hidden">아직 찾지 못한 노벨상.</span>
                <span className="tile__hint">{hintFor(id)}</span>
              </li>
            );
          }
          const icon = iconFor(id, got.objectId);
          return (
            <li key={id}>
              <button type="button" className="tile" onClick={() => onOpenPrize(id)}>
                {icon && <Icon name={icon} />}
                {meta}
                <span className="tile__title">{prize.titleKo}</span>
                <span className="tile__date">{formatDate(got.firstAt)} 처음 찾음</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="section-title">2차 도감 · 서비스 준비 중</h2>
      <p className="sub section-desc">더 많은 물건을 알아보는 인식 기능을 준비하고 있어요.</p>
      {p.stage2Unlocked ? (
        <ul className="tiles">
          {TIERS.stage2.map((id) => {
            const prize = PRIZE_BY_ID.get(id)!;
            const icon = iconFor(id);
            return (
              <li key={id}>
                <button type="button" className="tile tile--stage2" onClick={() => onOpenPrize(id)}>
                  {icon && <Icon name={icon} />}
                  <span className="tile__meta num">
                    {prize.year} · {prize.categoryKo}
                  </span>
                  <span className="tile__title">{prize.titleKo}</span>
                  <span className="tag">준비 중</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="callout">
          1차 도감에서 사물 {STAGE2_UNLOCK_OBJECTS}종을 모으면 열려요 (현재 <span className="num">{p.objects}</span>종)
        </p>
      )}

      <div className="collection__foot">
        <button
          type="button"
          className={complete ? "btn btn--primary" : "btn btn--secondary"}
          onClick={onShare}
          disabled={sharing || p.prizes === 0}
        >
          <Icon name="ui-share" small />
          도감 공유하기
        </button>
        <p className="notice">기록은 이 브라우저에만 저장돼요. 사진은 저장하지 않아요.</p>
        <button type="button" className="btn btn--text btn--quiet" onClick={() => setConfirming(true)}>
          기록 지우기
        </button>
      </div>

      {confirming && (
        <ConfirmSheet
          prizes={p.prizes}
          objects={p.objects}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onReset();
          }}
        />
      )}
    </main>
  );
}

/** 기록 지우기 확인. 브라우저 기본 confirm()은 쓰지 않는다 (명세 4.2) */
function ConfirmSheet({
  prizes,
  objects,
  onCancel,
  onConfirm,
}: {
  prizes: number;
  objects: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onCancel]);

  return (
    <>
      <div className="sheet-scrim" onClick={onCancel} />
      <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <h2 id="confirm-title">도감 기록을 지울까요?</h2>
        <p id="confirm-desc">
          찾은 노벨상 <span className="num">{prizes}</span>개와 사물 <span className="num">{objects}</span>종 기록이 모두
          지워져요. 되돌릴 수 없어요.
        </p>
        <div className="sheet__actions">
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            지우기
          </button>
        </div>
      </div>
    </>
  );
}
