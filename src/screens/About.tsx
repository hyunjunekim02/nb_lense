import { GITHUB_URL, SERVICE_NAME } from "../config";
import { Disclaimer, PHOTO_NOTICE } from "../components/Disclaimer";
import { Icon } from "../components/Icon";

export function About({ onBack }: { onBack: () => void }) {
  return (
    <main className="page about">
      <header className="topbar">
        <button type="button" className="btn btn--icon" onClick={onBack} aria-label="뒤로">
          <Icon name="ui-arrow-left" />
        </button>
        <h1>{SERVICE_NAME} 소개</h1>
      </header>

      <h2>일상에서 만나는 과학</h2>
      <p>
        사진 속 물건과 연결된 노벨상 연구를 찾아보세요. 일상에 쓰이는 과학을 알아보고, 직접 찾은 노벨상은 도감에 모을 수 있어요.
      </p>

      <h2>만든 사람</h2>
      <p>POSTECH 학생 4인이 Nobel Week 2026 파견단 활동의 하나로 만들었습니다.</p>
      <ul>
        <li>김현준 (개발 담당)</li>
        <li>문준혁</li>
        <li>조인재</li>
        <li>오은호</li>
      </ul>

      <h2>사진과 개인정보</h2>
      <p>
        {PHOTO_NOTICE} 사물 인식은 이 기기의 브라우저에서 이루어지며, 얼굴은 인식하지 않습니다.
      </p>
      <p>방문 수와 스캔 수 같은 익명 통계만 쿠키 없이 집계합니다.</p>

      <h2>데이터 출처</h2>
      <p>
        수상자 이름과 공식 수상 사유는{" "}
        <a href="https://www.nobelprize.org/" target="_blank" rel="noopener noreferrer">
          NobelPrize.org
        </a>
        의 공개 데이터(CC0)를 원문 그대로 사용합니다. 한국어 설명은 공식 수상 사유와 공개 자료를 바탕으로 정리했습니다.
      </p>
      <p>
        사물 인식: MediaPipe Object Detector (EfficientDet-Lite0, COCO). 아이콘:{" "}
        <a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer">
          Lucide
        </a>{" "}
        (ISC).
      </p>

      <h2>소스 코드</h2>
      <p>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub에서 보기
        </a>
      </p>

      <div style={{ padding: "24px 0 40px" }}>
        <Disclaimer />
      </div>
    </main>
  );
}
