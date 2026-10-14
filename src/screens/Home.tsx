import { useRef, useState } from "react";
import { SAMPLES, SERVICE_NAME } from "../config";
import { Icon } from "../components/Icon";
import { Disclaimer } from "../components/Disclaimer";

export function Home({
  onFile,
  onSample,
  onAbout,
  onCollection,
  collected,
  collectionTotal,
}: {
  onFile: (file: File) => void;
  onSample: (src: string) => void;
  onAbout: () => void;
  onCollection: () => void;
  /** 1차 도감에서 찾은 노벨상 수 */
  collected: number;
  collectionTotal: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSamples, setShowSamples] = useState(false);

  return (
    <main className="page home">
      <header className="home__top">
        <p className="brand">{SERVICE_NAME}</p>
        <button
          type="button"
          className="collection-btn"
          onClick={onCollection}
          aria-label={collected > 0 ? `내 도감, ${collectionTotal}개 중 ${collected}개` : "내 도감"}
        >
          <Icon name="book-open" />
          <span className="collection-btn__label" aria-hidden="true">
            도감
            {collected > 0 && (
              <span className="num collection-btn__count">
                {collected}/{collectionTotal}
              </span>
            )}
          </span>
        </button>
      </header>
      <div className="home__hero">
        <span className="home__symbol" aria-hidden="true">
          <Icon name="atom" />
        </span>
        <h1 className="headline">
          일상 속 노벨상,<br />사진으로 찾아보세요
        </h1>
        <p className="lead">
          물건 속에 숨은 연구를 발견하고<br />나만의 노벨상 도감을 채워보세요.
        </p>

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
              {showSamples ? "예시 사진 접기" : "예시로 먼저 둘러보기"}
            </button>
          </div>

          {showSamples && (
            <div id="samples" className="samples" role="group" aria-label="예시 사진">
              {SAMPLES.map((s) => (
                <button key={s.src} type="button" className="sample" onClick={() => onSample(s.src)}>
                  <img src={s.src} alt="" loading="lazy" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="home__footer">
        <p className="sub">사진은 저장·전송 없이 기기 안에서만 처리돼요.</p>
        <button type="button" className="btn btn--text btn--quiet" onClick={onAbout}>
          노벨 렌즈 소개
        </button>
        <Disclaimer />
      </footer>
    </main>
  );
}
