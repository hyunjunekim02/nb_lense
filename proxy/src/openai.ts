// OpenAI Chat Completions 요청·응답 형식 중 이 프록시가 다루는 부분.

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export type ChatMessage = {
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content: string | ContentPart[] | null;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
};

export function textOf(content: ChatMessage["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function imagesOf(content: ChatMessage["content"]): string[] {
  if (content == null || typeof content === "string") return [];
  return content
    .filter((p): p is Extract<ContentPart, { type: "image_url" }> => p.type === "image_url")
    .map((p) => p.image_url.url);
}

export function completion(model: string, text: string) {
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: null,
  };
}

/**
 * stream: true로 온 요청에 돌려줄 SSE 본문. 업스트림은 한 번에 받아 오고,
 * OpenAI SDK가 읽을 수 있게 조각 하나 + 끝 조각 + [DONE]으로 보낸다.
 */
export function completionSse(model: string, text: string): string {
  const base = { id: `chatcmpl-${crypto.randomUUID()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model };
  const chunks = [
    { ...base, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
  ];
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}
