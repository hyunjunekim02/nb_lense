import { useState } from "react";
import { OBJECTS } from "../data";
import { Icon } from "../components/Icon";

const AUTO = OBJECTS.filter((o) => o.cocoClass);
const MANUAL = OBJECTS.filter((o) => !o.cocoClass);

export function Picker({ onBack, onDone }: { onBack: () => void; onDone: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const renderGroup = (items: typeof OBJECTS) => (
    <div className="grid">
      {items.map((o) => (
        <button
          key={o.id}
          type="button"
          className="tile"
          aria-pressed={selected.includes(o.id)}
          onClick={() => toggle(o.id)}
        >
          <Icon name={o.icon} />
          {o.nameKo}
        </button>
      ))}
    </div>
  );

  return (
    <main className="page page--with-bar">
      <header className="topbar">
        <button type="button" className="btn btn--icon" onClick={onBack} aria-label="뒤로">
          <Icon name="ui-arrow-left" />
        </button>
        <h1>직접 고르기</h1>
      </header>
      <p className="lead" style={{ marginTop: 0 }}>
        주변에 있는 물건을 모두 골라 보세요.
      </p>

      <h2 className="sub section-label">사진으로도 찾을 수 있는 것</h2>
      {renderGroup(AUTO)}
      <h2 className="sub section-label">직접 골라야 하는 것</h2>
      {renderGroup(MANUAL)}

      <div className="bottom-bar">
        <div className="bottom-bar__inner">
          <button
            type="button"
            className="btn btn--primary"
            disabled={selected.length === 0}
            onClick={() => onDone(selected)}
          >
            <span>
              결과 보기 (<span className="num">{selected.length}</span>)
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
