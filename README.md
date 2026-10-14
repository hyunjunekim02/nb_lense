# 노벨 렌즈

사진 한 장을 올리면 **브라우저 안에서(서버 전송 없이)** 사진 속 사물을 인식하고, 그 사물 안에 숨은 노벨상 수상 연구를 보여주는 모바일 웹 서비스입니다. POSTECH Nobel Week 2026 파견단 프로젝트의 일부입니다.

> 이 서비스는 POSTECH 학생들이 만든 비공식 교육용 프로젝트로, 노벨재단 및 Nobel Prize Outreach와 관련이 없습니다. 수상 정보 출처: NobelPrize.org (CC0)

- 사물 인식: [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector) (EfficientDet-Lite0 int8, COCO), 기기 안에서 실행
- 설명은 모두 사람이 쓰고 검수한 정적 텍스트이며, LLM 호출은 없습니다
- 사진은 기기 밖으로 전송되지 않습니다. 분석은 쿠키 없는 GoatCounter로 이벤트 수만 집계합니다
- 직접 찍은 사진으로 찾은 노벨상은 **노벨상 도감**에 모입니다 (v1.1, 아래 "도감" 참고)

## 로컬 개발 환경 (macOS)

### 1. 준비물 (처음 한 번)

- **Node.js 22** (20.19 이상이면 동작). 버전 확인: `node -v`
  - 없다면 [nvm](https://github.com/nvm-sh/nvm)으로 설치하는 걸 권장합니다. 저장소에 `.nvmrc`가 있어서 폴더 안에서 `nvm install && nvm use`만 하면 맞는 버전이 잡힙니다.
  - Homebrew를 쓴다면 `brew install node@22`도 됩니다.
- **Git**. 맥에서는 `xcode-select --install`로 설치됩니다.

### 2. 받아서 설치

```bash
git clone https://github.com/hyunjunekim02/nb_lense.git
cd nb_lense
nvm use            # nvm을 쓰는 경우
npm install        # 설치가 끝나면 MediaPipe wasm이 public/wasm에 자동으로 복사됩니다
```

### 3. 개발 서버 띄우기

```bash
npm run dev
```

브라우저가 자동으로 **http://localhost:5173/nb_lense/** 를 엽니다. 코드나 `src/data/*.json`을 저장하면 화면이 바로 바뀝니다. 끄려면 터미널에서 `Ctrl + C`.

> 주소 끝의 `/nb_lense/`를 빼먹으면 빈 화면이 나옵니다. GitHub Pages 경로에 맞춰 둔 것이라 로컬에서도 같은 경로를 씁니다.

### 4. 검수할 때 쓰는 주소

| 주소 | 용도 |
|---|---|
| http://localhost:5173/nb_lense/ | 실제 서비스 화면 |
| http://localhost:5173/nb_lense/#review | **문구 검수 화면.** 노벨상 카드, 수상 사유, 사물별 "이 물건 속에서" 문구를 한 페이지에서 봅니다. 검수 전 항목에 표시가 붙습니다 |
| http://localhost:5173/nb_lense/?debug | **디버그 모드.** 사진을 올리면 결과 아래에 모델이 찾은 모든 클래스와 점수가 나옵니다. 오인식 기록, 임계값 조정에 씁니다 |
| http://localhost:5173/nb_lense/?debug&threshold=0.25 | 임계값을 바꿔서 실험 (기본값 0.35는 `src/config.ts`) |

`#review`와 `?debug`는 GitHub Pages 주소에서도 똑같이 동작합니다.

문구 검수 순서:
1. `npm run dev`를 켜고 `#review` 화면을 엽니다
2. `src/data/prizes.json`(노벨상 제목·설명)과 `src/data/objects.json`(사물별 "이 물건 속에서")을 고칩니다. 저장하면 화면에 바로 반영됩니다
3. 다 봤으면 해당 노벨상의 `"verified": false`를 `true`로 바꿉니다
4. 수상자 이름과 `motivationEn`(공식 수상 사유)은 손으로 고치지 말고 `npm run fetch-prizes`로 공식 API 원문을 받아옵니다

### 5. 배포본과 똑같이 확인하기

```bash
npm run pages      # 데이터 검사 → 타입 검사 → 빌드 → http://localhost:4173/nb_lense/ 로 열기
```

GitHub Pages에 올라가는 결과물(`dist/`)을 그대로 띄웁니다. 배포 전에 마지막으로 확인할 때 씁니다.

### 그 밖의 명령

```bash
npm run check          # 데이터 검사 + 타입 검사 + 테스트 (커밋 전에)
npm test               # 단위 테스트만
npm run fetch-prizes   # 노벨상 공식 API → src/data/prizes.json 갱신
```

### 자주 막히는 곳

- **화면이 하얗게 나와요**: 주소가 `/nb_lense/`로 끝나는지 확인하세요.
- **"인식 모델을 불러오지 못했어요"**: `public/wasm/` 폴더가 비어 있으면 `npm install`을 다시 하거나 `node scripts/copy-wasm.mjs`를 실행하세요.
- **`npm install`이 Node 버전 오류로 실패해요**: `node -v`가 20.19 이상인지 확인하세요.
- **포트가 이미 사용 중이래요**: 다른 터미널에 켜 둔 개발 서버를 끄거나, Vite가 알려 주는 다른 포트 주소로 들어가세요.
- 로컬에서는 분석 이벤트를 보내지 않습니다. 사진도 어디로도 전송되지 않습니다.

## 구조

```
public/models/   인식 모델 (efficientdet_lite0_uint8.tflite, 같은 출처에서 서빙)
public/wasm/     MediaPipe wasm (npm install 때 고정 버전 패키지에서 복사, git 제외)
public/samples/  예시 사진 3장 (현재 자리표시 이미지, 팀 사진으로 교체)
public/icons/    단색 라인 아이콘 (Lucide, ISC)
public/manifest.webmanifest, app-icon-*.png   홈 화면 추가용 (아이콘은 scripts/make-icons.mjs로 생성)
src/config.ts    서비스명·임계값·인식 단계 플래그·도감 설정
src/data/        objects.json(사물 → 노벨상, 도감 힌트), prizes.json(노벨상 정보)
src/lib/         recognizers/(단계별 인식 엔진), collection(도감), image(리사이즈·EXIF), mapping(결과 계산), analytics, shareCard
src/screens/     Home, Analyzing, Result, Collection(도감), About, Message(오류), Review(#review 검수)
src/sw.template.js  서비스 워커 템플릿 (빌드 때 vite.config.ts가 채워 dist/sw.js로 냄)
scripts/         fetch-prizes.ts(공식 API → prizes.json), check-data.mjs(빌드 전 검사), make-icons.mjs
```

## 데이터 다루기

- **사물 추가/수정**: `src/data/objects.json`. `cocoClass`가 있는 사물만 인식되어 앱에 나옵니다. 없는 사물은 `#review`에만 보입니다.
- **노벨상 문구**: `src/data/prizes.json`의 `titleKo`, `descKo`와 objects의 `whereKo`는 팀이 검수합니다. 검수가 끝나면 `verified`를 `true`로 바꾸세요. `false`가 남아 있으면 빌드할 때 경고가 나옵니다.
- **수상자·수상 사유**: `laureates`, `motivationEn`은 공식 API 값을 그대로 씁니다(약관상 수정 금지). 갱신은 `npm run fetch-prizes` 또는 GitHub Actions의 **Fetch prize data** 워크플로를 실행하면 결과가 커밋됩니다.
- 한 해에 주제가 둘인 상은 ID를 나눕니다(`2009-physics-fiber`, `2009-physics-ccd`). 결과 화면의 "노벨상 N개"는 이렇게 나눈 카드 수입니다.

## 도감 (v1.1)

- **무엇이 담기나**: 사진 올리기로 찾은 노벨상만 담깁니다. 예시 사진 결과는 보여주기만 하고 담지 않습니다.
- **1차·2차**: `cocoClass`가 있는 사물(지금 기기 안 모델로 인식되는 것)에 연결된 노벨상이 1차, 나머지가 2차입니다. 데이터에서 자동 계산되며(`src/lib/collection.ts`), `npm run check`가 개수를 출력합니다.
  - 1차 사물에는 잠긴 칸 힌트 `hintKo`가 꼭 있어야 합니다(사물 이름을 직접 말하지 않기). 없으면 빌드가 멈춥니다.
  - 2차 도감은 1차 사물을 `STAGE2_UNLOCK_OBJECTS`(기본 5)종 모으면 열립니다. 아직 사진으로 찾을 수 없어 "서비스 준비 중"으로 보이고, 칸을 누르면 설명만 읽을 수 있습니다.
- **저장 정책**: 사진은 저장하지 않습니다. 노벨상·사물 ID, 처음 찾은 날짜, 횟수만 이 브라우저의 localStorage(`nb_lense.collection.v1`)에 남습니다. 서버로 보내지 않으므로 기기·브라우저를 바꾸면 이어지지 않습니다. 저장이 막힌 환경에서는 화면을 닫을 때까지만 기록됩니다. 기록이 깨졌으면 `…v1.bak`에 원본을 남기고 새로 시작합니다.
- **앱 캐시**: 배포본에서는 서비스 워커가 앱 셸·아이콘을 미리 받아 두고, 모델·wasm·글꼴은 처음 쓸 때 캐시합니다. 한 번 스캔한 뒤에는 오프라인에서도 스캔과 도감 기록이 됩니다. 개발 서버(`npm run dev`)에서는 등록하지 않으니 `npm run pages`로 확인하세요.

### 단계별 인식 구조

작은 모델이 먼저 처리하고, 못 찾은 것만 더 큰 모델로 넘기는 구조입니다(`src/lib/recognizers/`). 켜고 끄는 값은 `src/config.ts`의 `RECOGNIZERS`입니다.

| 단계 | 엔진 | 위치 | 상태 |
|---|---|---|---|
| 1 | MediaPipe EfficientDet-Lite0 (COCO) — `coco.ts` | 기기 안 | 사용 중 |
| 2 | 제로샷 이미지 분류 (예: MobileCLIP) — `zeroshot.ts` | 기기 안 | 준비 중 (스텁) |
| 3 | 비전 LLM — `llm.ts` | 서버 | 준비 중 (스텁, 사용 전 동의 필요) |

`pipeline.ts`는 켜진 엔진을 단계 순서대로 돌리되, 상위 단계는 하위 단계가 0개를 찾았고 사용자가 요청했을 때만 시도합니다. 모든 엔진은 사물 ID(`objects.json`의 `id`)를 돌려주고, 문구는 언제나 검수된 정적 데이터에서 나옵니다.

## 배포 (GitHub Pages)

공개 주소: **https://hyunjunekim02.github.io/nb_lense/** (Pages를 켠 뒤부터)

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
   - 비공개 저장소는 GitHub Pro(학생은 [GitHub Student Developer Pack](https://education.github.com/pack)으로 무료)에서만 Pages를 쓸 수 있습니다. 메뉴가 막혀 있으면 저장소를 공개로 바꾸거나 Pro를 켜세요.
2. `main`에 push하면 `.github/workflows/deploy.yml`이 테스트·빌드 후 배포합니다. Pages를 켜기 전의 실행은 `configure-pages` 단계에서 실패하는데, 켠 뒤 Actions 탭에서 **Deploy to GitHub Pages → Run workflow**로 다시 돌리면 됩니다.
3. 분석을 켜려면 GoatCounter 사이트를 만든 뒤 Settings → Secrets and variables → Actions → Variables에 `GOATCOUNTER_CODE`(예: `nobellens`)를 추가하세요. 비어 있으면 아무것도 전송하지 않습니다.

`vite.config.ts`의 `base`는 저장소 이름(`/nb_lense/`)에 맞춰져 있습니다. 저장소 이름을 바꾸면 이 값도 바꿔야 합니다.

## 분석 이벤트

GoatCounter 대시보드에서 아래 경로로 집계됩니다. 사진·인식 이미지·위치 정보는 보내지 않습니다.

| 경로 | 의미 |
|---|---|
| `/` | 방문 |
| `scan_start/upload`, `scan_start/sample` | 스캔 시작 |
| `scan_success` (제목에 objects·prizes·ms) | 노벨상을 1개 이상 찾음 |
| `scan_empty` | 찾지 못함 |
| `prize_open/<prizeId>` | 상세 열기 |
| `share/share`, `share/download` | 공유 카드 |
| `model_load_fail` | 모델 로드 실패 |
| `collect_new/<prizeId>` | 노벨상을 도감에 처음 담음 |
| `collection_progress/<0~13>` | 업로드 스캔 뒤 1차 도감 개수 |
| `milestone/first`, `half`, `stage2`, `complete` | 마일스톤 첫 도달 |
| `collection_open` | 도감 화면 진입 |
| `collection_share/share`, `collection_share/download` | 도감 공유 카드 |
| `stage_placeholder_tap/llm`, `stage_placeholder_tap/zeroshot` | 준비 중 기능(AI로 더 찾기, 2차 칸)을 누름 |
| `collection_reset` | 도감 기록 지우기 |

## 법적 표기

- 공개 서비스명은 **노벨 렌즈**로 확정했습니다(`src/config.ts`의 `SERVICE_NAME`, `index.html` 메타 태그). 이름에 "노벨"이 들어가므로 비공식 고지문을 모든 화면과 공유 카드에 유지하고, 노벨상 측 로고·상표 디자인은 쓰지 않습니다.
- 공식 로고, 메달 이미지·형상, 수상자 사진을 쓰지 않습니다.
- 수상 사유(motivation) 원문은 수정하지 않습니다.
