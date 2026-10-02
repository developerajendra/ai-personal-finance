/**
 * MOCKED adapter tests: these verify request/response mapping only. They make
 * no network calls and do not prove live connectivity with real credentials.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { createAnthropicProvider } from "@/server/ai/providers/anthropic/adapter";
import { createOpenAIProvider } from "@/server/ai/providers/openai/adapter";
import { createProvider, getProvider } from "@/server/ai/providers";
import { FINANCE_TOOLS } from "@/server/ai/tools/financeTools";

afterEach(() => {
  vi.unstubAllGlobals();
  createMock.mockReset();
  delete process.env.AI_CHAT_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("anthropic adapter (mocked SDK)", () => {
  it("maps tools, tool calls and tool results to the Messages API", async () => {
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "Recording." },
        { type: "tool_use", id: "tu_1", name: "record_transaction", input: { amount: 5 } },
      ],
    });
    const provider = createAnthropicProvider({ apiKey: "k", model: "claude-sonnet-5-5", maxTokens: 100 });
    const res = await provider.generate({
      system: "sys",
      tools: FINANCE_TOOLS,
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "", toolCalls: [{ id: "tu_0", name: "get_financial_overview", input: {} }] },
        { role: "tool", results: [{ toolCallId: "tu_0", name: "get_financial_overview", content: "{}" }] },
      ],
    });
    expect(res).toEqual({ text: "Recording.", toolCalls: [{ id: "tu_1", name: "record_transaction", input: { amount: 5 } }] });
    const params = createMock.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.system).toBe("sys");
    expect(params.tools[0]).toHaveProperty("input_schema");
    expect(params.messages[1].content[0]).toEqual({ type: "tool_use", id: "tu_0", name: "get_financial_overview", input: {} });
    expect(params.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_0", content: "{}", is_error: false }],
    });
  });
});

describe("openai adapter (mocked fetch)", () => {
  it("maps function calls and parses arguments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: null, tool_calls: [{ id: "call_1", function: { name: "record_transaction", arguments: '{"amount":7}' } }] } }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = createOpenAIProvider({ apiKey: "k", model: "m", baseUrl: "https://api.example.test/v1" });
    const res = await provider.generate({ system: "s", messages: [{ role: "user", content: "x" }], tools: FINANCE_TOOLS });
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "record_transaction", input: { amount: 7 } }]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });
    expect(body.tools[0].type).toBe("function");
  });
});

describe("provider selection", () => {
  it("uses the configured provider and never falls back silently", () => {
    process.env.AI_CHAT_PROVIDER = "anthropic";
    expect(() => getProvider("chat")).toThrow(/ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = "k";
    expect(getProvider("chat").id).toBe("anthropic");
    expect(() => createProvider("openai")).toThrow(/OPENAI_API_KEY/);
  });
});
