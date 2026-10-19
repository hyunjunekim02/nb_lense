// POSTECH AI(genai.postech.ac.kr) → OpenAI 호환 변환.
//
// 모델 이름으로 업스트림을 고른다.
// - postech-gpt / postech-gemini / postech-claude / postech: 에이전트 API (a1, a2, a3, a10)
//   본문 { message, stream, files[{id,name,url}] }. 대화를 한 문자열로 펴서 보내고, 사진은 files의 url(data URL)로 넣는다.
// - 그 밖의 이름(gpt-5.2 등): OpenAI Responses API 중계(a11/openai/responses)에 모델 이름 그대로 보낸다.
import { imagesOf, textOf, type ChatRequest } from "./openai";
import { HttpError } from "./errors";
import { bodyToText } from "./text";

export type PostechEnv = {
  POSTECH_API_KEY?: string;
  /** 기본 https://genai.postech.ac.kr/agent/api */
  POSTECH_BASE_URL?: string;
  /** 키를 실을 헤더. 기본 Authorization (값 앞에 "Bearer "를 붙인다). 다른 헤더면 키를 그대로 싣는다 */
  POSTECH_AUTH_HEADER?: string;
};

export const POSTECH_AGENT_MODELS: Record<string, string> = {
  "postech-gpt": "a1/gpt",
  "postech-gemini": "a2/gemini",
  "postech-claude": "a3/claude",
  postech: "a10/postech",
};
const RESPONSES_PATH = "a11/openai/responses";

export type UpstreamRequest = { url: string; body: unknown };

/** OpenAI 대화를 에이전트 API의 message 한 문자열로 편다 */
export function flattenMessages(req: ChatRequest): string {
  const turns = req.messages.filter((m) => m.role !== "tool");
  if (turns.length === 1 && turns[0].role === "user") return textOf(turns[0].content);
  return turns
    .map((m) => {
      const role = m.role === "developer" ? "system" : m.role;
      return `[${role}]\n${textOf(m.content)}`;
    })
    .join("\n\n");
}

export function toPostech(req: ChatRequest, baseUrl: string): UpstreamRequest {
  const base = baseUrl.replace(/\/+$/, "");
  const agent = POSTECH_AGENT_MODELS[req.model];
  if (agent) {
    const images = req.messages.flatMap((m) => imagesOf(m.content));
    const body: Record<string, unknown> = { message: flattenMessages(req), stream: false };
    if (images.length) body.files = images.map((url, i) => ({ id: `image-${i + 1}`, name: `image-${i + 1}.jpg`, url }));
    return { url: `${base}/${agent}`, body };
  }

  // Responses API: system/developer → instructions, 나머지는 input 메시지
  const instructions = req.messages
    .filter((m) => m.role === "system" || m.role === "developer")
    .map((m) => textOf(m.content))
    .join("\n\n");
  const input = req.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string" || m.content == null
          ? [{ type: m.role === "assistant" ? "output_text" : "input_text", text: textOf(m.content) }]
          : m.content.map((p) =>
              p.type === "text"
                ? { type: m.role === "assistant" ? "output_text" : "input_text", text: p.text }
                : { type: "input_image", image_url: p.image_url.url },
            ),
    }));
  const body: Record<string, unknown> = { model: req.model, input, stream: false };
  if (instructions) body.instructions = instructions;
  const maxTokens = req.max_completion_tokens ?? req.max_tokens;
  if (maxTokens) body.max_output_tokens = maxTokens;
  return { url: `${base}/${RESPONSES_PATH}`, body };
}

export function authHeaders(env: PostechEnv): Record<string, string> {
  const key = env.POSTECH_API_KEY ?? "";
  const header = env.POSTECH_AUTH_HEADER || "Authorization";
  return { [header]: header.toLowerCase() === "authorization" ? `Bearer ${key}` : key };
}

/** POSTECH AI에 보내고 답 텍스트를 돌려준다 */
export async function callPostech(req: ChatRequest, env: PostechEnv, fetchFn: typeof fetch = fetch): Promise<string> {
  if (!env.POSTECH_API_KEY) throw new HttpError(500, "POSTECH_API_KEY is not set");
  const up = toPostech(req, env.POSTECH_BASE_URL || "https://genai.postech.ac.kr/agent/api");
  const res = await fetchFn(up.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders(env) },
    body: JSON.stringify(up.body),
  });
  const body = await res.text();
  if (!res.ok) throw new HttpError(res.status, body.slice(0, 500), true);
  return bodyToText(body, res.headers.get("content-type"));
}
