import type { CSSProperties } from "react";
import { ASSET_BASE } from "../config";

/** public/icons의 단색 라인 SVG. 장식용이라 스크린리더에서는 숨긴다. */
export function Icon({ name, small }: { name: string; small?: boolean }) {
  const file = name.endsWith(".svg") ? name : `${name}.svg`;
  const style = { "--icon": `url("${ASSET_BASE}icons/${file}")` } as CSSProperties;
  return <span className={small ? "icon icon--sm" : "icon"} style={style} aria-hidden="true" />;
}
