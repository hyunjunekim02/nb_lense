import { useRef, useState } from "react";
import { SAMPLES, SERVICE_NAME } from "../config";
import { Disclaimer } from "../components/Disclaimer";

export function Home({
  onFile,
  onSample,
  onAbout,
}: {
  onFile: (file: File) => void;
  onSample: (src: string) => void;
  onAbout: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSamples, setShowSamples] = useState(false);

  return (
    <main className="page home">
      <div>
        <p className="brand">{SERVICE_NAME}</p>
        <h1 className="headline">당신 폰에는 노벨상이 몇 개 들어 있을까?</h1>
        <p className="lead">사진을 올리면 그 속에 숨은 노벨상 연구를 찾아드려요.</p>

        <div className="home__actions">
          {/* capture 속성은 쓰지 않는다: 갤러리 선택을 막지 않기 위해 (명세 4.1) */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
          <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
            사진 올리기
          </button>

          <div className="home__links">
            <button
              type="button"
              className="btn btn--text"
              aria-expanded={showSamples}
              aria-controls="samples"
              onClick={() => setShowSamples((v) => !v)}
            >
              예시 사진으로 해보기
            </button>
          </div>

          {showSamples && (
            <div id="samples" className="samples" role="group" aria-label="예시 사진">
              {SAMPLES.map((s) => (
                <button key={s.src} type="button" className="sample" onClick={() => onSample(s.src)}>
                  <img src={s.src} alt={s.label} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="home__footer">
        <p className="sub">
          사진은 기기 밖으로 전송되지 않아요 ·{" "}
          <button type="button" className="btn btn--text" style={{ padding: 0, fontSize: "inherit" }} onClick={onAbout}>
            비공식 학생 프로젝트
          </button>
        </p>
        <Disclaimer />
      </footer>
    </main>
  );
}
