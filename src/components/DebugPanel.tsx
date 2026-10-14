import { DETECTOR, SCORE_THRESHOLD, ZEROSHOT } from "../config";
import { COCO_ALLOWLIST, OBJECT_BY_ID, OBJECTS } from "../data";
import type { Detection, ScanResult } from "../types";

/** ?debug 일 때 결과 화면 아래에 모델 원본 점수를 보여준다 (임계값 조정·오인식 기록용) */
export function DebugPanel({
  detections,
  inferenceMs,
  zeroshot,
}: {
  detections: Detection[];
  inferenceMs?: number;
  zeroshot?: ScanResult["zeroshot"];
}) {
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
      {zeroshot && <ZeroshotDebug zeroshot={zeroshot} />}
    </section>
  );
}

/** 2단계(제로샷) 점수표: 사물별 확률 합과 문장별 상위 확률 */
function ZeroshotDebug({ zeroshot }: { zeroshot: NonNullable<ScanResult["zeroshot"]> }) {
  const raw = zeroshot.raw;
  const name = (id: string | null) => (id ? (OBJECT_BY_ID.get(id)?.nameKo ?? id) : "해당 없음");
  return (
    <>
      <h3>2단계 제로샷 ({ZEROSHOT.modelId})</h3>
      {zeroshot.failed || !raw ? (
        <p className="sub">모델을 불러오지 못했어요. 콘솔 오류를 확인해 주세요.</p>
      ) : (
        <>
          <p className="sub">
            임계값 <b className="num">{raw.threshold}</b>
            {raw.threshold !== ZEROSHOT.threshold && ` (기본 ${ZEROSHOT.threshold})`} · 주소에 <code>&amp;zs=0.4</code>를
            붙여 바꿔 볼 수 있어요. 1위 사물이 &quot;해당 없음&quot;이 아니고 임계값을 넘어야 반영돼요.
          </p>
          <table>
            <thead>
              <tr>
                <th>사물</th>
                <th>확률 합</th>
              </tr>
            </thead>
            <tbody>
              {raw.objects.slice(0, 8).map((o, i) => (
                <tr key={o.objectId ?? "none"} className={i === 0 && o.objectId && o.prob >= raw.threshold ? "" : "debug__off"}>
                  <td>{name(o.objectId)}</td>
                  <td className="num">{o.prob.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>라벨 문장</th>
                <th>확률</th>
              </tr>
            </thead>
            <tbody>
              {raw.prompts.slice(0, 10).map((p) => (
                <tr key={p.label}>
                  <td>
                    {p.label} <span className="sub">({name(p.objectId)})</span>
                  </td>
                  <td className="num">{p.prob.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
