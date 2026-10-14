export type AnalyzingPhase = "model" | "detect" | "zeroshot-model";

const TEXT: Record<AnalyzingPhase, { title: string; lead: string }> = {
  model: { title: "사진 분석을 준비하고 있어요", lead: "처음에는 준비에 잠시 시간이 걸려요." },
  detect: { title: "사진 속 노벨상을 찾고 있어요", lead: "사진은 기기 안에서만 분석돼요." },
  // 2단계(제로샷) 모델은 수십 MB라 처음 한 번은 오래 걸린다
  "zeroshot-model": {
    title: "더 많은 물건을 찾아보고 있어요",
    lead: "처음 한 번은 모델을 받느라 시간이 걸려요. 사진은 기기 안에서만 분석돼요.",
  },
};

export function Analyzing({ imageUrl, phase }: { imageUrl: string; phase: AnalyzingPhase }) {
  const text = TEXT[phase];
  return (
    <main className="page analyzing" aria-busy="true">
      <div className="photo">
        <div className="photo__frame">
          <img src={imageUrl} alt="올린 사진" />
        </div>
      </div>
      <div className="progress" role="progressbar" aria-label="분석 진행 중">
        <div className="progress__bar" />
      </div>
      <h1 className="headline" aria-live="polite">{text.title}</h1>
      <p className="lead">{text.lead}</p>
    </main>
  );
}
