import type { PrizeHit } from "../types";
import { OBJECT_BY_ID } from "../data";
import { Icon } from "./Icon";

/** 결과 카드 한 장. where는 이미 표시할 사물 기준으로 골라 넘긴다. */
export function PrizeCard({
  hit,
  focusObjectId,
  showObjectName,
  onOpen,
}: {
  hit: PrizeHit;
  focusObjectId: string | null;
  showObjectName: boolean;
  onOpen: () => void;
}) {
  const { prize } = hit;
  const where = hit.where.find((w) => w.objectId === focusObjectId) ?? hit.where[0];
  const objectName = OBJECT_BY_ID.get(where.objectId)?.nameKo;
  const others = focusObjectId ? 0 : hit.where.length - 1;
  return (
    <li>
      <button type="button" className="card" onClick={onOpen}>
        <span className="card__body">
          <span className="card__meta">
            {prize.year} · {prize.categoryKo}
          </span>
          <span className="card__title">{prize.titleKo}</span>
          <span className="card__where">
            {showObjectName && !focusObjectId && objectName ? `${objectName}: ` : ""}
            {where.whereKo}
            {others > 0 ? ` 외 ${others}곳` : ""}
          </span>
        </span>
        <Icon name="ui-chevron-right" />
        <span className="visually-hidden">자세히 보기</span>
      </button>
    </li>
  );
}
