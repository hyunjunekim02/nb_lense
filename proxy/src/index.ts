// 노벨 렌즈 LLM 프록시 (Cloudflare Worker).
//
// POST /v1/recognize         앱(허용된 Origin)이 사진을 보내 후보 사물 중 하나를 고르게 한다
// POST /v1/chat/completions  POSTECH AI를 OpenAI Chat Completions 형식으로 쓰는 범용 엔드포인트 (PROXY_TOKEN 필요)
// GET  /v1/models            위 엔드포인트가 받는 모델 이름 (PROXY_TOKEN 필요)
// GET  /health               설정 상태 (키 값은 내보내지 않음)
import { HttpError } from "./errors";
import { completion, completionSse, type ChatRequest } from "./openai";
import { callPostech, DEFAULT_POSTECH_MODEL, POSTECH_AGENT_MODELS } from "./postech";
import { callVision, resolveProvider, type ProviderEnv } from "./providers";
import { buildUserText, parseAnswer, parseRecognizeRequest, SYSTEM_PROMPT, type RecognizeResponse } from "./recognize";

export type Env = ProviderEnv & {
  /** 쉼표로 구분한 허용 Origin. 예: https://hyunjunekim02.github.io,http://localhost:5173 */
  ALLOWED_ORIGINS?: string;
  /** /v1/chat/completions·/v1/models용 운영자 토큰. 비우면 두 엔드포인트를 닫는다 */
  PROXY_TOKEN?: string;
};

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

const errorBody = (status: number, message: string) => ({ error: { message, type: status >= 500 ? "server_error" : "invalid_request_error" } });

function allowedOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** 길이가 달라도 시간 차이가 덜 나게 비교한다 */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function requireToken(req: Request, env: Env) {
  if (!env.PROXY_TOKEN) throw new HttpError(403, "this endpoint is disabled (PROXY_TOKEN is not set)");
  const given = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(given, env.PROXY_TOKEN)) throw new HttpError(401, "invalid proxy token");
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
}

async function recognize(req: Request, env: Env, fetchFn: typeof fetch): Promise<RecognizeResponse> {
  const { image, candidates } = parseRecognizeRequest(await readJson(req));
  const { provider, model } = resolveProvider(env);
  const text = await callVision({ system: SYSTEM_PROMPT, text: buildUserText(candidates), imageDataUrl: image, maxTokens: 300 }, env, fetchFn);
  return { ...parseAnswer(text, candidates), provider, model };
}

async function chatCompletions(req: Request, env: Env, fetchFn: typeof fetch): Promise<Response> {
  const body = (await readJson(req)) as ChatRequest;
  if (!body || typeof body.model !== "string" || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HttpError(400, "model and messages are required");
  }
  const text = await callPostech(body, env, fetchFn);
  if (body.stream) {
    return new Response(completionSse(body.model, text), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
  }
  return json(completion(body.model, text));
}

function models() {
  const ids = [...Object.keys(POSTECH_AGENT_MODELS), DEFAULT_POSTECH_MODEL];
  return { object: "list", data: ids.map((id) => ({ id, object: "model", owned_by: "postech" })) };
}

export async function handle(req: Request, env: Env, fetchFn: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url);
  const origin = allowedOrigin(req, env);
  const cors = corsHeaders(origin);
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });

    if (url.pathname === "/health" && req.method === "GET") {
      const { provider, model } = resolveProvider(env);
      return json(
        {
          ok: true,
          provider,
          model,
          providerKey: provider === "postech" ? !!env.POSTECH_API_KEY : !!env.LLM_API_KEY,
          chatCompletions: !!env.PROXY_TOKEN && !!env.POSTECH_API_KEY,
        },
        200,
        cors,
      );
    }
    if (url.pathname === "/v1/recognize" && req.method === "POST") {
      // 브라우저 앱 전용. Origin은 브라우저 밖에서 위조할 수 있으니 Cloudflare 요청 수 제한 규칙도 함께 건다 (README)
      if (!origin) throw new HttpError(403, "origin not allowed");
      return json(await recognize(req, env, fetchFn), 200, cors);
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      requireToken(req, env);
      return await chatCompletions(req, env, fetchFn);
    }
    if (url.pathname === "/v1/models" && req.method === "GET") {
      requireToken(req, env);
      return json(models());
    }
    throw new HttpError(404, "not found");
  } catch (err) {
    if (err instanceof HttpError) {
      // 업스트림 4xx/5xx는 502로 감싸고 내용은 로그로만 남긴다 (키·내부 메시지를 앱에 그대로 내보내지 않게)
      if (err.upstream) {
        console.error(`upstream ${err.status}: ${err.message}`);
        return json(errorBody(502, `upstream error (${err.status})`), 502, cors);
      }
      return json(errorBody(err.status, err.message), err.status, cors);
    }
    console.error(err);
    return json(errorBody(500, "internal error"), 500, cors);
  }
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
};
