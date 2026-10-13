# 노벨 렌즈 (작업명)

사진 한 장을 올리면 **브라우저 안에서(서버 전송 없이)** 사진 속 사물을 인식하고, 그 사물 안에 숨은 노벨상 수상 연구를 보여주는 모바일 웹 서비스입니다. POSTECH Nobel Week 2026 파견단 프로젝트의 일부입니다.

> 이 서비스는 POSTECH 학생들이 만든 비공식 교육용 프로젝트로, 노벨재단 및 Nobel Prize Outreach와 관련이 없습니다. 수상 정보 출처: NobelPrize.org (CC0)

- 사물 인식: [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector) (EfficientDet-Lite0 int8, COCO), 기기 안에서 실행
- 설명은 모두 사람이 쓰고 검수한 정적 텍스트이며, LLM 호출은 없습니다
- 사진은 기기 밖으로 전송되지 않습니다. 분석은 쿠키 없는 GoatCounter로 이벤트 수만 집계합니다

## 실행

```bash
npm install        # MediaPipe wasm을 public/wasm으로 복사 (postinstall)
npm run dev        # http://localhost:5173/nb_lense/
npm test           # mapping 단위 테스트 + 데이터 무결성
npm run build      # 데이터 검사 → 타입 검사 → 빌드 (dist/)
```

Node 22 기준입니다.

## 구조

```
public/models/   인식 모델 (efficientdet_lite0_uint8.tflite, 같은 출처에서 서빙)
public/wasm/     MediaPipe wasm (설치 시 고정 버전 npm 패키지에서 복사, git 제외)
public/samples/  예시 사진 3장 (현재 자리표시 이미지, 팀 사진으로 교체)
public/icons/    단색 라인 아이콘 (Lucide, ISC)
src/config.ts    서비스명·임계값·기능 플래그 (서비스명은 여기 한 곳에서만 관리)
src/data/        objects.json(사물 → 노벨상), prizes.json(노벨상 정보)
src/lib/         detector(인식), image(리사이즈·EXIF), mapping(결과 계산), analytics, shareCard
src/screens/     Home, Analyzing, Result, Picker(직접 고르기), About, Message(오류)
scripts/         fetch-prizes.ts(공식 API → prizes.json), check-data.mjs(빌드 전 검사)
```

## 데이터 다루기

- **사물 추가/수정**: `src/data/objects.json`. `cocoClass`가 있으면 자동 인식, 없으면 직접 고르기 전용입니다.
- **노벨상 문구**: `src/data/prizes.json`의 `titleKo`, `descKo`와 objects의 `whereKo`는 팀이 검수합니다. 검수가 끝나면 `verified`를 `true`로 바꾸세요. `false`가 남아 있으면 빌드할 때 경고가 나옵니다.
- **수상자·수상 사유**: `laureates`, `motivationEn`은 공식 API 값을 그대로 씁니다(약관상 수정 금지). 갱신은 `npm run fetch-prizes` 또는 GitHub Actions의 **Fetch prize data** 워크플로를 실행하면 결과가 커밋됩니다.
- 한 해에 주제가 둘인 상은 ID를 나눕니다(`2009-physics-fiber`, `2009-physics-ccd`). 결과 화면의 "노벨상 N개"는 이렇게 나눈 카드 수입니다.

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정
2. `main`에 push하면 `.github/workflows/deploy.yml`이 테스트·빌드 후 배포합니다
3. 분석을 켜려면 GoatCounter 사이트를 만든 뒤 Settings → Secrets and variables → Actions → Variables에 `GOATCOUNTER_CODE`(예: `nobellens`)를 추가하세요. 비어 있으면 아무것도 전송하지 않습니다

`vite.config.ts`의 `base`는 저장소 이름(`/nb_lense/`)에 맞춰져 있습니다.

## 분석 이벤트

GoatCounter 대시보드에서 아래 경로로 집계됩니다. 사진·인식 이미지·위치 정보는 보내지 않습니다.

| 경로 | 의미 |
|---|---|
| `/` | 방문 |
| `scan_start/upload`, `scan_start/sample`, `scan_start/manual` | 스캔 시작 |
| `scan_success` (제목에 objects·prizes·ms) | 노벨상을 1개 이상 찾음 |
| `scan_empty` | 찾지 못함 |
| `prize_open/<prizeId>` | 상세 열기 |
| `share/share`, `share/download` | 공유 카드 |
| `model_load_fail` | 모델 로드 실패 |

## 법적 표기

- 노벨상 측 이름·로고·상표를 서비스 제목이나 로고에 쓰지 않습니다. 공개 서비스명은 미정이며 `src/config.ts`의 `SERVICE_NAME`만 바꾸면 됩니다.
- 공식 로고, 메달 이미지·형상, 수상자 사진을 쓰지 않습니다.
- 수상 사유(motivation) 원문은 수정하지 않습니다.
