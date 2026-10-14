import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { TEST_UNLOCK } from "../config";
import { PRIZE_BY_ID } from "../data";
import { hintFor, iconFor, isStage2Photo, progress, TIERS, type CollectionState } from "../lib/collection";
import { Icon } from "../components/Icon";
import type { PrizeCategory } from "../types";

/** 2026-10-14 → "10월 14일" (올해가 아니면 연도도) */
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const md = `${m}월 ${d}일`;
  return y === new Date().getFullYear() ? md : `${y}년 ${md}`;
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

type Tab = "stage1" | "stage2";
type Filter = PrizeCategory | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "physics", label: "물리학상" },
  { id: "chemistry", label: "화학상" },
  { id: "medicine", label: "생리의학상" },
];

/** 내 노벨상 도감 (v1.1 명세 4.2). 1차·2차 도감을 탭으로 나눠 보여준다 */
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
  const [tab, setTab] = useState<Tab>("stage1");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);
  const matches = (id: string) => filter === "all" || PRIZE_BY_ID.get(id)?.category === filter;
  const stage1Ids = TIERS.stage1.filter(matches);
  const stage2Ids = TIERS.stage2.filter(matches);
  // 2단계(제로샷)가 켜져 있으면 2차 중 일부는 1차처럼 사진으로 모은다
  const photo = new Set(TIERS.stage2.filter((id) => isStage2Photo(id)));
  const emptyNote = <p className="sub filter-empty" role="status">이 단계에는 해당 부문의 노벨상이 없어요.</p>;
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ stage1: null, stage2: null });
  const showInstallHint = persistent && !state.ui.installHintDismissed && isIosSafari() && !isStandalone();

  // 탭 키보드 이동 (WAI-ARIA tabs: 좌우 화살표)
  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = tab === "stage1" ? "stage2" : "stage1";
    setTab(next);
    tabRefs.current[next]?.focus();
  };
  const tabProps = (id: Tab) => ({
    ref: (el: HTMLButtonElement | null) => {
      tabRefs.current[id] = el;
    },
    type: "button" as const,
    role: "tab",
    id: `tab-${id}`,
    "aria-selected": tab === id,
    "aria-controls": `panel-${id}`,
    tabIndex: tab === id ? 0 : -1,
    className: "tabs__tab",
    onClick: () => setTab(id),
    onKeyDown: onTabKey,
  });

  return (
    <main className="page collection">
      <header className="topbar">
        <button type="button" className="btn btn--icon" onClick={onBack} aria-label="뒤로">
          <Icon name="ui-arrow-left" />
        </button>
        <h1>내 노벨상 도감</h1>
      </header>

      {TEST_UNLOCK && (
        <p className="callout">테스트용 도감이에요(?unlock). 1차가 모두 채워져 있고, 실제 기록과 따로 저장돼요.</p>
      )}
      {!persistent && <p className="callout">기록을 저장할 수 없는 브라우저예요. 앱을 닫으면 기록이 사라져요.</p>}
      {showInstallHint && (
        <div className="callout callout--row">
          <span>홈 화면에 추가하면 기록이 더 오래 보관돼요</span>
          <button type="button" className="btn btn--icon" onClick={onDismissInstallHint} aria-label="안내 닫기">
            <Icon name="ui-x" small />
          </button>
        </div>
      )}

      <section className="collection__summary">
        <p className="sub collection__eyebrow">사진으로 모은 노벨상</p>
        <h2 className="headline">
          <span className="num">{p.prizes}</span>개 발견
          <span className="collection__total num"> / {p.prizeTotal}개</span>
        </h2>
        <p className="lead">
          {p.stage2Unlocked
            ? "1차 도감 완성! 2차 도감도 둘러보세요."
            : p.prizes === 0
              ? "사진을 올려 첫 노벨상을 찾아보세요."
              : "빈칸의 힌트를 따라 다음 노벨상을 찾아보세요."}
        </p>
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
      </section>

      <div className="tabs" role="tablist" aria-label="도감 단계">
        <button {...tabProps("stage1")}>
          1차 도감{" "}
          <span className="num tabs__count">
            {p.prizes}/{p.prizeTotal}
          </span>
        </button>
        <button {...tabProps("stage2")}>
          2차 도감{" "}
          <span className="num tabs__count">
            {photo.size > 0 ? `${p.stage2Prizes}/${p.stage2PrizeTotal}` : TIERS.stage2.length}
          </span>
          {!p.stage2Unlocked && <Icon name="lock" small />}
        </button>
      </div>

      <div className="chips filters" role="group" aria-label="노벨상 부문 필터">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {tab === "stage1" ? (
        <section role="tabpanel" id="panel-stage1" aria-labelledby="tab-stage1" className="tabs__panel">
          {stage1Ids.length === 0 && emptyNote}
          <ul className="tiles">
            {stage1Ids.map((id) => (
              <PrizeTile key={id} id={id} state={state} onOpenPrize={onOpenPrize} />
            ))}
          </ul>
        </section>
      ) : (
        <section role="tabpanel" id="panel-stage2" aria-labelledby="tab-stage2" className="tabs__panel">
          <p className="sub section-desc">
            {photo.size > 0
              ? `${photo.size}개는 1차처럼 사진으로 찾을 수 있어요. 나머지는 연구를 둘러보세요.`
              : "더 많은 노벨상 연구를 둘러보세요. 사진으로 찾는 기능은 준비 중이에요."}
          </p>
          {stage2Ids.length === 0 && emptyNote}
          <div className={p.stage2Unlocked ? "stage2" : "stage2 stage2--locked"}>
            {/* 잠겨 있으면 목록은 보여주되 누를 수 없게 하고, 스크린리더에는 아래 안내만 읽힌다 */}
            <ul className="tiles" aria-hidden={!p.stage2Unlocked} inert={!p.stage2Unlocked}>
              {stage2Ids.map((id) => {
                const prize = PRIZE_BY_ID.get(id)!;
                if (photo.has(id)) return <PrizeTile key={id} id={id} state={state} onOpenPrize={onOpenPrize} />;
                return (
                  <li key={id}>
                    <button type="button" className="tile tile--stage2" onClick={() => onOpenPrize(id)}>
                      <Icon name={iconFor(id)} />
                      <span className="tile__meta num">
                        {prize.year} · {prize.categoryKo}
                      </span>
                      <span className="tile__title">{prize.titleKo}</span>
                      <span className="tag">사진 인식 준비 중</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!p.stage2Unlocked && (
              <div className="stage2__overlay">
                <div className="stage2__message" role="note">
                  <Icon name="lock" />
                  <strong>1차 도감을 완성하면 열려요</strong>
                  <span className="sub">
                    남은 <span className="num">{p.prizeTotal - p.prizes}</span>개를 찾아보세요.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="collection__foot">
        <button
          type="button"
          className={p.stage2Unlocked ? "btn btn--primary" : "btn btn--secondary"}
          onClick={onShare}
          disabled={sharing || p.prizes === 0}
        >
          <Icon name="ui-share" small />
          {sharing ? "공유 준비 중…" : "도감 공유하기"}
        </button>
        <p className="notice">기록은 이 브라우저에만 저장돼요. 사진은 저장하지 않아요.</p>
        <button type="button" className="btn btn--text btn--quiet" onClick={() => setConfirming(true)}>
          기록 지우기
        </button>
      </div>

      {confirming && (
        <ConfirmSheet
          prizes={p.prizes}
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

/** 사진으로 모으는 칸: 찾았으면 노벨상, 아니면 잠긴 칸과 힌트 */
function PrizeTile({ id, state, onOpenPrize }: { id: string; state: CollectionState; onOpenPrize: (id: string) => void }) {
  const prize = PRIZE_BY_ID.get(id)!;
  const got = state.prizes[id];
  const meta = (
    <span className="tile__meta num">
      {prize.year} · {prize.categoryKo}
    </span>
  );
  if (!got) {
    return (
      <li className="tile tile--locked">
        <span className="tile__mark" aria-hidden="true">
          ?
        </span>
        {meta}
        <span className="visually-hidden">아직 찾지 못한 노벨상.</span>
        <span className="tile__hint">{hintFor(id)}</span>
      </li>
    );
  }
  return (
    <li>
      <button type="button" className="tile" onClick={() => onOpenPrize(id)}>
        <Icon name={iconFor(id, got.objectId)} />
        {meta}
        <span className="tile__title">{prize.titleKo}</span>
        <span className="tile__date">{formatDate(got.firstAt)} 발견</span>
      </button>
    </li>
  );
}

/** 기록 지우기 확인. 브라우저 기본 confirm()은 쓰지 않는다 (명세 4.2) */
function ConfirmSheet({
  prizes,
  onCancel,
  onConfirm,
}: {
  prizes: number;
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
          찾은 노벨상 <span className="num">{prizes}</span>개의 기록이 삭제돼요. 되돌릴 수 없어요.
        </p>
        <div className="sheet__actions">
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            기록 지우기
          </button>
        </div>
      </div>
    </>
  );
}
