# 노벨 렌즈

사진 속 일상 사물을 브라우저에서 인식하고, 그 물건과 이어지는 노벨상 연구를 보여주는 모바일 웹 앱입니다. Nobel Week 2026 파견단 활동의 하나로 만들었습니다.

**데모:** [hyunjunekim02.github.io/nb_lense](https://hyunjunekim02.github.io/nb_lense/)

> 노벨 렌즈는 비공식 교육용 프로젝트입니다. 노벨재단 및 Nobel Prize Outreach와 관련이 없습니다.

## 무엇을 할 수 있나요?

- 직접 찍거나 고른 사진에서 지원 사물을 찾습니다.
- 사물에 연결된 노벨상과 일상 속 활용 사례를 읽을 수 있습니다.
- 직접 찾은 항목은 이 브라우저의 **노벨상 도감**에 기록됩니다. 1차 도감을 완성하면 2차 도감이 열립니다.
- 예시 사진으로 설치 없이 바로 체험할 수 있습니다.

현재 인식기는 COCO 데이터셋의 클래스 가운데 서비스가 지원하는 14종의 사물만 판별합니다. 1차 도감을 완성하면 COCO에 없는 사물 26종을 찾는 2단계 제로샷 인식이 켜집니다([아래](#2단계-제로샷-인식) 참고). 인식 결과는 환경과 사진에 따라 틀릴 수 있으며, 노벨상 설명은 미리 작성한 정적 콘텐츠입니다. 앱에서 생성형 AI나 LLM을 호출하지 않습니다.

## 사진과 개인정보

사진 추론은 [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector)가 사용자의 브라우저 안에서 수행합니다. 업로드한 사진은 서버로 전송하거나 저장하지 않습니다.

- 도감에는 항목 ID, 처음 찾은 날짜, 발견 횟수만 `localStorage`에 저장됩니다.
- 모델과 WebAssembly 파일은 이 사이트에서 내려받아 브라우저 캐시에 보관할 수 있습니다.
- 2차 도감이 열린 뒤에는 2단계 제로샷 인식을 위해 MobileCLIP 모델 파일을 Hugging Face에서 한 번 내려받습니다. 이때도 사진은 기기 밖으로 나가지 않습니다.
- 운영자가 GoatCounter를 설정한 배포본만 방문·기능 사용 이벤트를 쿠키 없이 전송합니다. 사진, 위치, 화면 크기, 이전 페이지 주소는 보내지 않습니다.
- GoatCounter 설정이 비어 있는 기본 빌드는 분석 요청을 보내지 않습니다.

## 기술 구성

- React 19, TypeScript, Vite
- MediaPipe Tasks Vision 1.1.0
- EfficientDet-Lite0 int8 객체 감지 모델 (1단계)
- Transformers.js + MobileCLIP-S0 제로샷 분류 (2단계, 2차 도감)
- GitHub Pages와 서비스 워커 기반 PWA
- Nobel Prize API 기반 수상자·공식 수상 사유 데이터

## 로컬에서 실행하기

Node.js 22를 권장하며 최소 20.19 이상이 필요합니다.

```bash
git clone https://github.com/hyunjunekim02/nb_lense.git
cd nb_lense
npm install
npm run dev
```

개발 서버는 `http://localhost:5173/nb_lense/`를 엽니다. `npm install` 뒤 MediaPipe WebAssembly 파일이 `public/wasm/`에 복사됩니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run check` | 데이터 검사, 타입 검사, 단위 테스트 |
| `npm run build` | 배포용 빌드 생성 |
| `npm run pages` | 배포 빌드를 로컬에서 미리보기 |
| `npm run fetch-prizes` | Nobel Prize API에서 공식 데이터 갱신 |

문구 검수는 `/nb_lense/#review`, 모델 결과 확인은 `/nb_lense/?debug`에서 할 수 있습니다. `?debug&threshold=0.25`처럼 임계값을 임시로 바꿀 수도 있습니다.

### 2단계 제로샷 인식

COCO에 없는 물건(모기, 현미경, 알약 등)은 2단계 제로샷 분류로 찾습니다. 1차 도감을 완성해 2차 도감이 열리면, 1단계가 아무것도 못 찾은 사진을 MobileCLIP이 사진 전체와 라벨 문장들을 비교해 다시 봅니다. 2차 도감 가운데 이 사물들에 연결된 25개는 1차처럼 잠긴 칸과 힌트로 보이고, 사진으로 찾으면 열립니다.

- `?zeroshot`: 2차 도감이 열리기 전에도 2단계를 돌려 봅니다(실험용). 이때 찾은 2차 노벨상은 도감에 담기지 않습니다.
- `/nb_lense/?zeroshot&debug`: 결과 화면 아래 디버그 표에 사물별 확률과 상위 라벨 문장이 나옵니다.
- `&zs=0.4`처럼 제로샷 임계값(기본 0.5, `src/config.ts`의 `ZEROSHOT.threshold`)을 바꿔 볼 수 있습니다.
- 처음 한 번은 Hugging Face에서 모델(수십 MB)을 받느라 오래 걸리고, 이후에는 브라우저 캐시를 씁니다.
- 라벨은 `src/data/objects.json`의 `zeroshotLabelsEn`, 어느 사물에도 해당하지 않는 사진을 거르는 라벨은 `ZEROSHOT.negativeLabelsEn`에서 고칩니다.
- 2차 노벨상은 1차 도감을 완성한 뒤에 찍은 사진만 도감에 담깁니다.
- `?unlock`을 붙이면 1차가 모두 채워진 테스트용 도감으로 열립니다. 실제 기록과 다른 키에 저장되므로 원래 도감은 그대로입니다. 2차 수집까지 실험하려면 `/nb_lense/?unlock&zeroshot&debug`를 쓰세요.

## 프로젝트 구조

```text
public/models/   브라우저에서 실행할 객체 감지 모델 (2단계 MobileCLIP은 실행 시 Hugging Face에서 받음)
public/samples/  실재 인물이 없는 AI 생성 예시 사진
public/icons/    Lucide 기반 인터페이스 아이콘
src/data/        사물-노벨상 연결과 노벨상 설명
src/lib/         인식(recognizers/: 1단계 COCO, 2단계 제로샷), 도감, 이미지 처리, 분석 로직
src/screens/     사용자 화면과 검수 화면
scripts/         데이터 검사, 공식 데이터 갱신, 빌드 보조 도구
```

사물과 노벨상의 연결은 [`src/data/objects.json`](src/data/objects.json), 노벨상 설명은 [`src/data/prizes.json`](src/data/prizes.json)에서 관리합니다. `laureates`와 `motivationEn`은 공식 API 값이므로 `npm run fetch-prizes`로 갱신합니다.

## 배포

`main`에 push하면 [배포 워크플로](.github/workflows/deploy.yml)가 검사와 빌드를 거쳐 GitHub Pages에 배포합니다. 저장소의 **Settings → Pages → Build and deployment**에서 Source를 **GitHub Actions**로 설정해야 합니다.

분석을 켜려면 Actions 변수 `GOATCOUNTER_CODE`에 GoatCounter 사이트 코드를 넣습니다. `VITE_` 환경 변수는 브라우저 번들에 포함되므로 비밀 키나 토큰을 저장하면 안 됩니다.

## 데이터와 저작권

- 수상자 이름과 공식 수상 사유는 [Nobel Prize API](https://www.nobelprize.org/organization/developer-zone-2/)의 공개 데이터를 사용합니다.
- 한국어 제목·설명과 사물 연결 문구는 프로젝트 팀이 작성했습니다.
- 객체 감지 모델, 폰트, 아이콘 등 외부 구성요소의 출처와 라이선스는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)에 정리했습니다.
- 예시 사진 3장은 AI로 생성했으며 실재 인물의 사진이 아닙니다.

이 저장소 자체에는 아직 오픈 소스 라이선스가 부여되지 않았습니다. 공개 열람이 코드·콘텐츠의 복제, 수정, 배포 허락을 뜻하지 않으며, 외부 구성요소에는 각각의 라이선스가 적용됩니다.

## 만든 사람

- 김현준 — 개발
- 문준혁
- 조인재
- 오은호
