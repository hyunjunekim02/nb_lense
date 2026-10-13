export function Analyzing({ imageUrl, phase }: { imageUrl: string; phase: "model" | "detect" }) {
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
      <p aria-live="polite">{phase === "model" ? "인식 모델 준비 중… (처음 한 번만)" : "사진 속 사물을 찾는 중"}</p>
    </main>
  );
}
