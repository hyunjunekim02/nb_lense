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
      <h1 className="headline" aria-live="polite">{phase === "model" ? "사진 분석을 준비하고 있어요" : "사진 속 노벨상을 찾고 있어요"}</h1>
      <p className="lead">{phase === "model" ? "처음에는 준비에 잠시 시간이 걸려요." : "사진은 기기 안에서만 분석돼요."}</p>
    </main>
  );
}
