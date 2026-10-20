// 업스트림 응답에서 텍스트를 꺼내는 도우미. POSTECH AI 에이전트 API는 응답 형식이 문서로 확정되지 않아
// 흔히 쓰는 필드 이름을 차례로 찾아본다.

const TEXT_KEYS = ["output_text", "content", "text", "answer", "response", "result", "reply", "message", "data", "candidates", "parts"];

/** JSON 응답 어딘가에 든 답 문자열을 찾는다. 못 찾으면 null */
export function extractText(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map((v) => extractText(v, depth + 1)).filter((v): v is string => !!v);
    return parts.length ? parts.join("") : null;
  }
  if (typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  // POSTECH 응답은 { code, message: "operation success", data: <LLM 응답> }로 감싸진다.
  // 상태 안내 message를 모델의 답으로 읽으면 정상 인식도 빈 결과가 된다.
  if ("code" in obj && "data" in obj) return extractText(obj.data, depth + 1);

  // OpenAI Chat Completions
  if (Array.isArray(obj.choices)) {
    const c = obj.choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    const t = extractText(c?.message?.content ?? c?.text, depth + 1);
    if (t) return t;
  }
  // OpenAI Responses API: output[].content[].text (type: output_text)
  if (Array.isArray(obj.output)) {
    const parts: string[] = [];
    for (const item of obj.output as { type?: string; content?: { type?: string; text?: string }[] }[]) {
      if (item?.type && item.type !== "message") continue;
      for (const c of item?.content ?? []) if (c?.type === "output_text" && typeof c.text === "string") parts.push(c.text);
    }
    if (parts.length) return parts.join("");
  }
  for (const key of TEXT_KEYS) {
    if (key in obj) {
      const t = extractText(obj[key], depth + 1);
      if (t) return t;
    }
  }
  return null;
}

/**
 * 스트리밍(SSE)으로 온 본문을 텍스트로 합친다. 조각마다 JSON이면 그 안의 글자(delta 우선)를,
 * JSON이 아니면 그대로 이어 붙인다.
 */
export function joinSse(body: string): string {
  let out = "";
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data) as Record<string, unknown>;
      const choice = Array.isArray(json.choices) ? (json.choices[0] as { delta?: { content?: string } }) : undefined;
      const delta = choice?.delta?.content ?? (typeof json.delta === "string" ? json.delta : undefined);
      out += delta ?? extractText(json) ?? "";
    } catch {
      out += data;
    }
  }
  return out;
}

/** 업스트림 본문 → 텍스트 (JSON, SSE, 일반 텍스트 모두) */
export function bodyToText(body: string, contentType: string | null): string {
  if (contentType?.includes("text/event-stream") || /^\s*data:/.test(body)) return joinSse(body);
  try {
    return extractText(JSON.parse(body)) ?? "";
  } catch {
    return body;
  }
}
