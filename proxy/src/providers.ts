// 비전 LLM 공급자 어댑터. 사진 한 장 + 지시문을 보내고 답 텍스트를 받는다.
// 키는 운영자(admin)가 Worker 시크릿 LLM_API_KEY로 넣는다. 브라우저에는 절대 내려가지 않는다.
import { HttpError } from "./errors";
import { callPostech, DEFAULT_POSTECH_MODEL, type PostechEnv } from "./postech";
import { bodyToText } from "./text";

export type Provider = "openai" | "anthropic" | "gemini" | "postech";

export type ProviderEnv = PostechEnv & {
  /** openai | anthropic | gemini | postech (기본 postech) */
  LLM_PROVIDER?: string;
  /** 공급자별 모델 이름. 비우면 DEFAULT_MODELS */
  LLM_MODEL?: string;
  /** openai·anthropic·gemini 키 (postech는 POSTECH_API_KEY) */
  LLM_API_KEY?: string;
  /** openai 호환 서버 주소 (기본 https://api.openai.com/v1) */
  OPENAI_BASE_URL?: string;
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-haiku-5-5",
  gemini: "gemini-2.5-flash",
  postech: DEFAULT_POSTECH_MODEL,
};

export type VisionInput = {
  system: string;
  text: string;
  /** data:image/jpeg;base64,... */
  imageDataUrl: string;
  maxTokens: number;
};

export function resolveProvider(env: ProviderEnv): { provider: Provider; model: string } {
  const name = (env.LLM_PROVIDER || "postech").toLowerCase();
  if (!(name in DEFAULT_MODELS)) throw new HttpError(500, `unknown LLM_PROVIDER: ${name}`);
  const provider = name as Provider;
  return { provider, model: env.LLM_MODEL || DEFAULT_MODELS[provider] };
}

export function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new HttpError(400, "image must be a base64 data URL");
  return { mediaType: m[1].toLowerCase(), base64: m[2] };
}

async function post(fetchFn: typeof fetch, url: string, headers: Record<string, string>, body: unknown): Promise<string> {
  const res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text.slice(0, 500), true);
  return bodyToText(text, res.headers.get("content-type"));
}

function requireKey(env: ProviderEnv): string {
  if (!env.LLM_API_KEY) throw new HttpError(500, "LLM_API_KEY is not set");
  return env.LLM_API_KEY;
}

/** 설정된 공급자에 사진과 지시문을 보내고 답 텍스트를 돌려준다 */
export async function callVision(input: VisionInput, env: ProviderEnv, fetchFn: typeof fetch = fetch): Promise<string> {
  const { provider, model } = resolveProvider(env);
  const { mediaType, base64 } = splitDataUrl(input.imageDataUrl);

  switch (provider) {
    case "openai": {
      const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
      return post(fetchFn, `${base}/chat/completions`, { Authorization: `Bearer ${requireKey(env)}` }, {
        model,
        max_completion_tokens: input.maxTokens,
        messages: [
          { role: "system", content: input.system },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: input.imageDataUrl, detail: "low" } },
              { type: "text", text: input.text },
            ],
          },
        ],
      });
    }
    case "anthropic":
      return post(
        fetchFn,
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": requireKey(env), "anthropic-version": "2023-06-01" },
        {
          model,
          max_tokens: input.maxTokens,
          system: input.system,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: input.text },
              ],
            },
          ],
        },
      );
    case "gemini":
      return post(
        fetchFn,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": requireKey(env) },
        {
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: mediaType, data: base64 } }, { text: input.text }] }],
          generationConfig: { maxOutputTokens: input.maxTokens, responseMimeType: "application/json" },
        },
      );
    case "postech":
      // 프록시 안의 POSTECH 변환을 그대로 쓴다 (모델 이름 규칙은 postech.ts)
      return callPostech(
        {
          model,
          max_completion_tokens: input.maxTokens,
          messages: [
            { role: "system", content: input.system },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: input.imageDataUrl } },
                { type: "text", text: input.text },
              ],
            },
          ],
        },
        env,
        fetchFn,
      );
  }
}
