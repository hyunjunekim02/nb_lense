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

      <h2>무엇인가요</h2>
      <p>
        일상의 물건 속에 숨은 노벨상 연구를 사진 한 장으로 찾아보는 서비스입니다. 기초과학의 발견이 공학을 거쳐 우리
        손안의 기술이 되는 선순환을 직접 확인해 보세요.
      </p>

      <h2>만든 사람</h2>
      <p>POSTECH Nobel Week 2026 파견단 활동의 하나로 만들었습니다.</p>
      <ul>
        <li>김현준 (개발 담당)</li>
        <li>문준혁</li>
        <li>조인재</li>
        <li>오은호</li>
      </ul>

      <h2>사진과 개인정보</h2>
      <p>
        {PHOTO_NOTICE} 사물 인식 모델이 이 기기의 브라우저 안에서 돌아가며, 서버 비용도 들지 않습니다. 사람이 찍혀도
        얼굴은 인식하지 않습니다.
      </p>
      <p>
        운영자가 분석을 켠 경우에만 방문 수와 스캔 수 같은 집계용 이벤트를 쿠키 없이 전송합니다. 사진, 위치, 화면
        크기, 이전 페이지 주소는 보내지 않습니다.
      </p>

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
