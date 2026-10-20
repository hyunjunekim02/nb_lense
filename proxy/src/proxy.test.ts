import { describe, expect, it, vi } from "vitest";
import { handle, type Env } from "./index";
import { DEFAULT_POSTECH_MODEL, flattenMessages, toPostech } from "./postech";
import { parseAnswer, parseRecognizeRequest } from "./recognize";
import { bodyToText } from "./text";

const IMAGE = "data:image/jpeg;base64,/9j/4AAQ";
const ORIGIN = "https://hyunjunekim02.github.io";
const env: Env = {
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
  POSTECH_API_KEY: "test-key",
  PROXY_TOKEN: "proxy-token",
};

function fakeFetch(body: unknown, status = 200, contentType = "application/json") {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": contentType } }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://proxy.example${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("POSTECH 변환", () => {
  it("postech-* 모델의 텍스트 대화는 에이전트 API로 보낸다", () => {
    const up = toPostech(
      {
        model: "postech-gpt",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "What is this?" },
        ],
      },
      "https://genai.postech.ac.kr/agent/api/",
    );
    expect(up.url).toBe("https://genai.postech.ac.kr/agent/api/a1/gpt");
    expect(up.body).toEqual({
      message: "[system]\nBe brief.\n\n[user]\nWhat is this?",
      stream: false,
    });
  });

  it.each(["postech-gpt", "postech-gemini", "postech-claude", "postech"])("%s의 이미지 입력은 비전 API 모델로 안내한다", (model) => {
    expect(() => toPostech({ model, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: IMAGE } }] }] }, "https://genai.postech.ac.kr/agent/api"))
      .toThrow(/do not support image input/);
  });

  it("사용자 메시지 하나뿐이면 역할 표시 없이 그대로 보낸다", () => {
    expect(flattenMessages({ model: "postech", messages: [{ role: "user", content: "hi" }] })).toBe("hi");
  });

  it("그 밖의 모델은 Responses API(a11)에 모델 이름을 그대로 넘긴다", () => {
    const up = toPostech(
      {
        model: DEFAULT_POSTECH_MODEL,
        max_tokens: 50,
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: [{ type: "image_url", image_url: { url: IMAGE } }, { type: "text", text: "?" }] },
        ],
      },
      "https://genai.postech.ac.kr/agent/api",
    );
    expect(up.url).toBe("https://genai.postech.ac.kr/agent/api/a11/openai/responses");
    expect(up.body).toEqual({
      model: DEFAULT_POSTECH_MODEL,
      instructions: "Be brief.",
      max_output_tokens: 50,
      stream: false,
      store: false,
      input: [{ role: "user", content: [{ type: "input_image", image_url: IMAGE }, { type: "input_text", text: "?" }] }],
    });
  });
});

describe("응답 텍스트 꺼내기", () => {
  it.each([
    ["Chat Completions", { choices: [{ message: { content: "A" } }] }],
    ["Responses API", { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "A" }] }] }],
    ["output_text", { output_text: "A" }],
    ["중첩된 data.content", { data: { content: "A" } }],
    ["POSTECH 성공 안내보다 실제 Responses 답변 우선", { code: "200", message: "operation success", data: { output: [{ type: "message", content: [{ type: "output_text", text: "A" }] }] } }],
    ["POSTECH로 감싼 Chat Completions", { code: "200", message: "operation success", data: { choices: [{ message: { content: "A" } }] } }],
    ["message 필드", { message: "A" }],
  ])("%s", (_name, body) => {
    expect(bodyToText(JSON.stringify(body), "application/json")).toBe("A");
  });

  it("SSE 조각을 이어 붙인다", () => {
    const sse = 'data: {"choices":[{"delta":{"content":"He"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n';
    expect(bodyToText(sse, "text/event-stream")).toBe("Hello");
  });

  it("JSON이 아니면 본문 그대로", () => {
    expect(bodyToText("plain answer", "text/plain")).toBe("plain answer");
  });

  it("POSTECH의 data가 비어 있으면 성공 안내를 모델 답변으로 사용하지 않는다", () => {
    expect(bodyToText(JSON.stringify({ code: "200", message: "operation success", data: null }), "application/json")).toBe("");
  });
});

describe("/v1/chat/completions", () => {
  const body = { model: "postech-gpt", messages: [{ role: "user", content: "hi" }] };

  it("토큰이 없으면 401", async () => {
    const res = await handle(post("/v1/chat/completions", body), env, fakeFetch({}));
    expect(res.status).toBe(401);
  });

  it("PROXY_TOKEN이 설정되지 않았으면 닫혀 있다", async () => {
    const res = await handle(post("/v1/chat/completions", body, { Authorization: "Bearer x" }), { ...env, PROXY_TOKEN: "" }, fakeFetch({}));
    expect(res.status).toBe(403);
  });

  it("POSTECH 답을 OpenAI 형식으로 돌려주고, 키를 X-Api-Key로 싣는다", async () => {
    const f = fakeFetch({ content: "hello" });
    const res = await handle(post("/v1/chat/completions", body, { Authorization: "Bearer proxy-token" }), env, f);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    expect(data.choices[0].message.content).toBe("hello");
    const init = f.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("test-key");
    expect(headers.Authorization).toBeUndefined();
  });

  it("Authorization을 명시한 게이트웨이는 Bearer 인증을 유지한다", async () => {
    const f = fakeFetch({ content: "hello" });
    await handle(post("/v1/chat/completions", body, { Authorization: "Bearer proxy-token" }), { ...env, POSTECH_AUTH_HEADER: "Authorization" }, f);
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["X-Api-Key"]).toBeUndefined();
  });

  it("stream: true면 SSE로 돌려준다", async () => {
    const res = await handle(post("/v1/chat/completions", { ...body, stream: true }, { Authorization: "Bearer proxy-token" }), env, fakeFetch({ content: "hi" }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"content":"hi"');
    expect(text.trim().endsWith("data: [DONE]")).toBe(true);
  });

  it("업스트림 오류 내용은 내보내지 않고 502로 감싼다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handle(post("/v1/chat/completions", body, { Authorization: "Bearer proxy-token" }), env, fakeFetch("secret detail", 401, "text/plain"));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret detail");
    spy.mockRestore();
  });
});

describe("/v1/recognize", () => {
  const candidates = [
    { id: "microscope", name: "microscope (현미경)" },
    { id: "mosquito", name: "mosquito (모기)" },
  ];

  it("허용되지 않은 Origin은 403", async () => {
    const res = await handle(post("/v1/recognize", { image: IMAGE, candidates }, { Origin: "https://evil.example" }), env, fakeFetch({}));
    expect(res.status).toBe(403);
  });

  it("후보 중 하나를 고른 답을 돌려주고 CORS 헤더를 붙인다", async () => {
    const f = fakeFetch({ code: "200", message: "operation success", data: { output: [{ type: "message", content: [{ type: "output_text", text: '```json\n{"objectId":"microscope","confidence":0.82}\n```' }] }] } });
    const res = await handle(post("/v1/recognize", { image: IMAGE, candidates }, { Origin: ORIGIN }), env, f);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(await res.json()).toEqual({ objectId: "microscope", confidence: 0.82, provider: "postech", model: DEFAULT_POSTECH_MODEL });
    expect(String(f.mock.calls[0][0])).toContain("a11/openai/responses");
    const init = f.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: DEFAULT_POSTECH_MODEL,
      store: false,
      input: [{ role: "user", content: [{ type: "input_image", image_url: IMAGE }, { type: "input_text" }] }],
    });
  });

  it("/v1/models에 기본 비전 모델의 실제 POSTECH 배포명을 노출한다", async () => {
    const res = await handle(new Request("https://proxy.example/v1/models", { headers: { Authorization: "Bearer proxy-token" } }), env);
    expect(res.status).toBe(200);
    expect((await res.json() as { data: { id: string }[] }).data).toContainEqual({ id: DEFAULT_POSTECH_MODEL, object: "model", owned_by: "postech" });
  });

  it.each([
    ["anthropic", "https://api.anthropic.com/v1/messages", { content: [{ type: "text", text: '{"objectId":"mosquito","confidence":0.7}' }] }],
    ["gemini", "generativelanguage.googleapis.com", { candidates: [{ content: { parts: [{ text: '{"objectId":"mosquito","confidence":0.7}' }] } }] }],
    ["openai", "https://api.openai.com/v1/chat/completions", { choices: [{ message: { content: '{"objectId":"mosquito","confidence":0.7}' } }] }],
  ])("%s 공급자", async (provider, urlPart, reply) => {
    const f = fakeFetch(reply);
    const res = await handle(post("/v1/recognize", { image: IMAGE, candidates }, { Origin: ORIGIN }), { ...env, LLM_PROVIDER: provider, LLM_API_KEY: "k" }, f);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { objectId: string }).objectId).toBe("mosquito");
    expect(String(f.mock.calls[0][0])).toContain(urlPart);
  });

  it("OPTIONS 사전 요청에 응답한다", async () => {
    const res = await handle(new Request("https://proxy.example/v1/recognize", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("판별 요청·답 검사", () => {
  const candidates = [{ id: "pill", name: "pill" }];

  it("이미지가 data URL이 아니면 거절", () => {
    expect(() => parseRecognizeRequest({ image: "https://x/y.jpg", candidates })).toThrow(/data URL/);
  });

  it("후보 ID 형식과 중복을 검사한다", () => {
    expect(() => parseRecognizeRequest({ image: IMAGE, candidates: [{ id: "A B", name: "x" }] })).toThrow(/id/);
    expect(() => parseRecognizeRequest({ image: IMAGE, candidates: [...candidates, ...candidates] })).toThrow(/id/);
  });

  it("후보 밖 ID나 깨진 JSON은 null", () => {
    expect(parseAnswer('{"objectId":"cat","confidence":0.9}', candidates).objectId).toBeNull();
    expect(parseAnswer("I think it's a pill", candidates).objectId).toBeNull();
    expect(parseAnswer('{"objectId":null,"confidence":0}', candidates).objectId).toBeNull();
  });

  it("확신도는 0~1로 자른다", () => {
    expect(parseAnswer('{"objectId":"pill","confidence":7}', candidates)).toEqual({ objectId: "pill", confidence: 1 });
  });
});
