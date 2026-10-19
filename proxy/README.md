# 노벨 렌즈 LLM 프록시

노벨 렌즈 3단계(비전 LLM) 인식과 POSTECH AI를 잇는 Cloudflare Worker입니다. 노벨 렌즈는 GitHub Pages의 정적 사이트라서 운영자 API 키를 브라우저 번들에 넣을 수 없습니다. 그래서 키는 이 Worker의 시크릿으로만 두고, 앱은 Worker 주소로 사진을 보냅니다.

| 경로 | 쓰는 쪽 | 하는 일 |
| --- | --- | --- |
| `POST /v1/recognize` | 노벨 렌즈 앱 (`ALLOWED_ORIGINS`의 Origin만) | 사진과 후보 사물 목록을 받아 설정된 LLM에 묻고 `{ objectId, confidence }`를 돌려줍니다 |
| `POST /v1/chat/completions` | 운영자 (`PROXY_TOKEN` 필요) | POSTECH AI를 OpenAI Chat Completions 형식으로 씁니다 |
| `GET /v1/models` | 운영자 (`PROXY_TOKEN` 필요) | 위 엔드포인트가 받는 모델 이름 |
| `GET /health` | 누구나 | 공급자·모델 이름과 키가 들어 있는지 여부 (키 값은 내보내지 않음) |

## 공급자 고르기

`wrangler.toml`의 `LLM_PROVIDER`로 `/v1/recognize`가 물어볼 곳을 고릅니다. 모델은 `LLM_MODEL`로 바꿀 수 있고, 비우면 아래 기본값을 씁니다.

| `LLM_PROVIDER` | 키 시크릿 | 기본 모델 | 호출하는 API |
| --- | --- | --- | --- |
| `postech` (기본) | `POSTECH_API_KEY` | `gpt-5.2` | POSTECH AI (아래 규칙) |
| `openai` | `LLM_API_KEY` | `gpt-5.2` | Chat Completions. `OPENAI_BASE_URL`로 다른 OpenAI 호환 서버도 됩니다 |
| `anthropic` | `LLM_API_KEY` | `claude-haiku-5-5` | Messages API |
| `gemini` | `LLM_API_KEY` | `gemini-2.5-flash` | `generateContent` |

## POSTECH AI → OpenAI 호환 규칙

`/v1/chat/completions`와 `LLM_PROVIDER=postech`는 같은 변환을 씁니다. 모델 이름에 따라 POSTECH AI의 엔드포인트가 정해집니다.

| 모델 이름 | POSTECH AI 엔드포인트 | 보내는 본문 |
| --- | --- | --- |
| `postech-gpt` | `a1/gpt` | `{ message, stream: false, files }` |
| `postech-gemini` | `a2/gemini` | 〃 |
| `postech-claude` | `a3/claude` | 〃 |
| `postech` | `a10/postech` | 〃 |
| 그 밖의 이름 (`gpt-5.2` 등) | `a11/openai/responses` | OpenAI Responses API 본문 (모델 이름 그대로) |

- 에이전트 엔드포인트(a1~a10)는 대화를 `[system]`, `[user]`처럼 역할을 붙인 문자열 하나로 펴서 `message`에 넣고, 사진은 `files[].url`에 data URL로 넣습니다.
- 업스트림은 항상 한 번에 받아 옵니다. 요청이 `stream: true`면 받은 답을 OpenAI 스트리밍(SSE) 형식으로 다시 내보냅니다.
- 키는 기본으로 `Authorization: Bearer <키>`에 싣습니다. POSTECH AI가 다른 헤더를 쓰면 `POSTECH_AUTH_HEADER`(예: `X-API-Key`)를 설정합니다.
- 응답 형식은 문서로 확정되지 않아 `output_text`, `choices[0].message.content`, `content`, `message`, `answer` 같은 흔한 필드를 차례로 찾습니다(`src/text.ts`).

## 로컬에서 실행하기

```bash
cd proxy
npm install
cp .dev.vars.example .dev.vars   # POSTECH_API_KEY, PROXY_TOKEN 채우기 (커밋 금지)
npm run dev                      # http://localhost:8787
```

다른 터미널에서 확인합니다.

```bash
# POSTECH AI를 OpenAI 형식으로 (Responses API 경로)
curl -s http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $PROXY_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"한 단어로 인사해 줘"}]}'

# 에이전트 엔드포인트 경로
curl -s http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $PROXY_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"postech-gpt","messages":[{"role":"user","content":"한 단어로 인사해 줘"}]}'
```

OpenAI SDK에서도 그대로 쓸 수 있습니다: `new OpenAI({ baseURL: "http://localhost:8787/v1", apiKey: PROXY_TOKEN })`.

프록시가 502를 돌려주면 `npm run dev` 터미널 로그에 POSTECH AI가 보낸 상태 코드와 본문이 찍힙니다. 프록시를 거치지 않고 POSTECH AI를 직접 확인하려면:

```bash
curl -s https://genai.postech.ac.kr/agent/api/a1/gpt \
  -H "Authorization: Bearer $POSTECH_API_KEY" -H "Content-Type: application/json" \
  -d '{"message":"한 단어로 인사해 줘","stream":false}'
```

## 배포 (Cloudflare Workers)

```bash
cd proxy
npx wrangler login
npx wrangler secret put POSTECH_API_KEY   # LLM_PROVIDER=postech일 때
npx wrangler secret put LLM_API_KEY       # openai·anthropic·gemini일 때
npx wrangler secret put PROXY_TOKEN       # /v1/chat/completions를 열 때 (길고 무작위로)
npm run deploy                            # https://nb-lense-llm-proxy.<계정>.workers.dev
```

그다음 GitHub 저장소 **Settings → Secrets and variables → Actions → Variables**에 `LLM_ENDPOINT`로 Worker 주소를 넣으면 다음 배포부터 앱이 그 주소를 압니다. 3단계를 실제로 켜려면 `src/config.ts`의 `RECOGNIZERS.llm`을 `true`로 바꾸고 사진 전송 동의 화면을 붙여야 합니다.

### 남용 막기

- `/v1/recognize`는 `ALLOWED_ORIGINS`에 있는 Origin에서 온 요청만 받습니다. Origin은 브라우저 밖에서 위조할 수 있으므로, Cloudflare 대시보드의 **Security → WAF → Rate limiting rules**에서 `/v1/recognize`에 IP당 요청 수 제한(예: 분당 10회)을 거는 것을 권합니다.
- 사진은 data URL 2MB, 후보는 200개까지 받습니다(`src/recognize.ts`의 `LIMITS`).
- `PROXY_TOKEN`을 비워 두면 `/v1/chat/completions`와 `/v1/models`는 닫힙니다.
- 업스트림 오류 내용은 앱에 내보내지 않고 502와 상태 코드만 돌려줍니다.

## 테스트

저장소 루트의 `npm test`가 `proxy/src/*.test.ts`도 함께 돌리고, `npm run check`가 `tsc -p proxy`로 타입을 검사합니다.
