import { OBJECTS, PRIZES, PRIZE_BY_ID } from "../data";
import { Icon } from "../components/Icon";

/**
 * 팀 검수용 화면 (주소 끝에 #review). 앱에 나오는 모든 문구를 한 페이지에 모아 보여준다.
 * 문구 수정은 src/data/prizes.json, objects.json에서 하고, 검수가 끝나면 verified를 true로 바꾼다.
 */
export function Review() {
  const todo = PRIZES.filter((p) => !p.verified).length;
  return (
    <main className="page review">
      <header className="topbar">
        <h1 style={{ paddingLeft: 10 }}>문구 검수</h1>
      </header>
      <p className="lead" style={{ marginTop: 0 }}>
        노벨상 {PRIZES.length}개 중 <b className="num">{todo}</b>개가 검수 전이에요. 수정은{" "}
        <code>src/data/prizes.json</code>, <code>src/data/objects.json</code>에서 하고, 개발 서버가 켜져 있으면 저장하는
        즉시 이 화면에 반영돼요.
      </p>

      <h2>노벨상 (prizes.json)</h2>
      {PRIZES.map((p) => (
        <article key={p.id} className="review-item">
          <div className="sub num">
            {p.year} · {p.categoryKo} · <code>{p.id}</code>{" "}
            <span className={p.verified ? "tag" : "tag tag--todo"}>{p.verified ? "검수 완료" : "검수 전"}</span>
          </div>
          <h3>{p.titleKo}</h3>
          <span className="review-label">설명 (descKo)</span>
          <p>{p.descKo}</p>
          <span className="review-label">수상자 · 공식 수상 사유 (API 원문, 수정 금지)</span>
          <p className="sub">{p.laureates.join(", ")}</p>
          <p lang="en">“{p.motivationEn}”</p>
          <span className="review-label">이 노벨상이 들어 있는 사물</span>
          <ul>
            {OBJECTS.flatMap((o) =>
              o.prizes
                .filter((l) => l.prizeId === p.id)
                .map((l) => (
                  <li key={o.id}>
                    {o.nameKo}: {l.whereKo}
                  </li>
                )),
            )}
          </ul>
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
            출처
          </a>
        </article>
      ))}

      <h2>사물 (objects.json)</h2>
      {OBJECTS.map((o) => (
        <article key={o.id} className="review-item">
          <div className="sub">
            <code>{o.id}</code> · {o.cocoClass ? `자동 인식 (COCO: ${o.cocoClass})` : "직접 고르기 전용"}
          </div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={o.icon} />
            {o.nameKo}
          </h3>
          <ul>
            {o.prizes.map((l) => {
              const p = PRIZE_BY_ID.get(l.prizeId);
              return (
                <li key={l.prizeId}>
                  <span className="num">{p ? `${p.year} ${p.titleKo}` : `⚠ 없는 ID ${l.prizeId}`}</span>: {l.whereKo}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
      <div style={{ height: 40 }} />
    </main>
  );
}
