import type { ObjectEntry } from "../types";
import { Icon } from "./Icon";

export function ObjectChip({
  object,
  selected,
  onToggle,
}: {
  object: ObjectEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onToggle}>
      <Icon name={object.icon} small />
      {object.nameKo}
    </button>
  );
}
