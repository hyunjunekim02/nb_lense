import { DETECTOR, SCORE_THRESHOLD } from "../config";
import { COCO_ALLOWLIST, OBJECTS } from "../data";
import type { Detection } from "../types";

/** ?debug 일 때 결과 화면 아래에 모델 원본 점수를 보여준다 (임계값 조정·오인식 기록용) */
export function DebugPanel({ detections, inferenceMs }: { detections: Detection[]; inferenceMs?: number }) {
  const rows = [...detections].sort((a, b) => b.score - a.score);
  return (
    <section className="debug" aria-label="디버그 정보">
      <h2>디버그</h2>
      <p className="sub">
        임계값 <b className="num">{SCORE_THRESHOLD}</b>
        {SCORE_THRESHOLD !== DETECTOR.scoreThreshold && ` (기본 ${DETECTOR.scoreThreshold})`} · 추론{" "}
        <span className="num">{inferenceMs != null ? `${Math.round(inferenceMs)}ms` : "-"}</span> · 주소에{" "}
        <code>&amp;threshold=0.25</code>를 붙여 바꿔 볼 수 있어요
      </p>
      {rows.length === 0 ? (
        <p className="sub">모델이 아무것도 찾지 못했어요.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>COCO 클래스</th>
              <th>점수</th>
              <th>결과 반영</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => {
              const allowed = COCO_ALLOWLIST.includes(d.cocoClass);
              const used = allowed && d.score >= SCORE_THRESHOLD;
              const name = OBJECTS.find((o) => o.cocoClass === d.cocoClass)?.nameKo;
              return (
                <tr key={i} className={used ? "" : "debug__off"}>
                  <td>
                    {d.cocoClass}
                    {name ? ` (${name})` : ""}
                  </td>
                  <td className="num">{d.score.toFixed(2)}</td>
                  <td>{used ? "반영" : allowed ? "점수 미달" : "허용 목록 밖"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
