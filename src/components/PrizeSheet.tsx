import { useEffect, useRef } from "react";
import type { PrizeEntry } from "../types";
import { OBJECT_BY_ID } from "../data";
import { Icon } from "./Icon";

/** 노벨상 상세 바텀 시트 (명세 4.4). 수상자 사진·메달 이미지는 넣지 않는다. */
export function PrizeSheet({
  prize,
  where,
  notice,
  onClose,
}: {
  prize: PrizeEntry;
  where: { objectId: string; whereKo: string }[];
  /** 시트 맨 위 안내 (예: 2차 도감의 "준비 중") */
  notice?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet__head">
          <div>
            <div className="sub num">
              {prize.year} · {prize.categoryKo}
            </div>
            <h2 id="sheet-title">{prize.titleKo}</h2>
            <div className="sub">{prize.laureates.join(", ")}</div>
          </div>
          <button ref={closeRef} type="button" className="btn btn--icon" onClick={onClose} aria-label="닫기">
            <Icon name="ui-x" />
          </button>
        </div>

        {notice && <p className="sheet__notice">{notice}</p>}

        <h3>어떤 연구인가요</h3>
        <p>{prize.descKo}</p>

        <h3>공식 수상 사유</h3>
        <blockquote lang="en">“{prize.motivationEn}”</blockquote>

        {where.length > 0 && (
          <>
            <h3>이 물건 속에서</h3>
            {where.length === 1 ? (
              <p>
                {OBJECT_BY_ID.get(where[0].objectId)?.nameKo}: {where[0].whereKo}
              </p>
            ) : (
              <ul>
                {where.map((w) => (
                  <li key={w.objectId}>
                    {OBJECT_BY_ID.get(w.objectId)?.nameKo}: {w.whereKo}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h3>출처</h3>
        <p>
          <a href={prize.sourceUrl} target="_blank" rel="noopener noreferrer">
            NobelPrize.org에서 {prize.year}년 {prize.categoryKo} 보기
          </a>
        </p>
      </div>
    </>
  );
}
