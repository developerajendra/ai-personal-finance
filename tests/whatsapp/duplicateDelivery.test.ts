import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, scriptedProvider } from "../helpers";
import { db } from "@/server/db/client";
import { whatsappInboundMessages, whatsappOutboundMessages } from "@/server/db/schema";
import { acceptInbound, processInbound, sendOutbound } from "@/server/jobs/whatsapp";
import { isValidSignature, parseInboundMessages } from "@/server/integrations/whatsapp/webhook";
import { startLink, tryVerifyLink } from "@/server/integrations/whatsapp/linking";
import { createTransactionOnce, listTransactions } from "@/server/finance/transactions/service";

const msg = (id: string, from: string, body: string) => ({ waMessageId: id, from, type: "text", body, timestamp: "1" });

async function linkedUser(phone: string) {
  const userId = await createUser();
  const { code } = await startLink(userId, `+${phone}`);
  const res = await tryVerifyLink(phone, `LINK ${code}`);
  expect(res).toMatchObject({ handled: true, ok: true, userId });
  return userId;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
});

describe("webhook security", () => {
  it("accepts only bodies signed with the app secret", () => {
    const body = JSON.stringify({ entry: [] });
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(isValidSignature(body, sig, "s3cret")).toBe(true);
    expect(isValidSignature(body + " ", sig, "s3cret")).toBe(false);
    expect(isValidSignature(body, sig, "other")).toBe(false);
    expect(isValidSignature(body, null, "s3cret")).toBe(false);
  });

  it("parses text messages from the Cloud API payload", () => {
    const parsed = parseInboundMessages({
      entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "wamid.1", from: "919800000001", type: "text", text: { body: "hi" } }], statuses: [] } }] }],
    });
    expect(parsed).toEqual([{ waMessageId: "wamid.1", from: "919800000001", type: "text", body: "hi", timestamp: null }]);
  });
});

describe("linking", () => {
  it("rejects a wrong code and locks after repeated failures", async () => {
    const userId = await createUser();
    await startLink(userId, "+91 98000 00009");
    for (let i = 0; i < 5; i++) {
      expect(await tryVerifyLink("919800000009", "LINK 000000")).toMatchObject({ ok: false });
    }
    // Even the right code can't be brute-forced after the lockout; a new code is required.
    const fresh = await startLink(userId, "+91 98000 00009");
    expect(await tryVerifyLink("919800000009", `LINK ${fresh.code}`)).toMatchObject({ ok: true });
  });
});

describe("duplicate delivery", () => {
  it("stores a message once even when Meta retries concurrently", async () => {
    const m = msg("wamid.dup", "919800000002", "spent 100 on tea");
    const results = await Promise.all([acceptInbound([m]), acceptInbound([m]), acceptInbound([m])]);
    expect(results.flat()).toHaveLength(1);
    const rows = await db.select().from(whatsappInboundMessages).where(eq(whatsappInboundMessages.waMessageId, "wamid.dup"));
    expect(rows).toHaveLength(1);
  });

  it("concurrent processing creates one transaction and one reply", async () => {
    const phone = "919800000003";
    const userId = await linkedUser(phone);
    const [id] = await acceptInbound([msg("wamid.proc", phone, "spent 250 on lunch")]);
    const provider = () =>
      scriptedProvider([
        { text: "", toolCalls: [{ id: "c", name: "record_transaction", input: { amount: 250, direction: "expense", description: "Lunch" } }] },
        { text: "Saved.", toolCalls: [] },
      ]);
    const outcomes = await Promise.all([processInbound(id, { provider: provider() }), processInbound(id, { provider: provider() })]);
    expect(outcomes.filter((o) => o === "processed")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "skipped")).toHaveLength(1);
    const txns = await listTransactions(userId);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ amount: 250, source: "whatsapp", sourceRef: "wamid.proc:txn:0" });
    const replies = await db.select().from(whatsappOutboundMessages).where(eq(whatsappOutboundMessages.inboundId, id));
    expect(replies).toHaveLength(1);
    expect(replies[0].body).toContain("Expense recorded: Rs 250");
  });

  it("a retried write with the same message id returns the original row", async () => {
    const userId = await createUser();
    const input = { date: "2026-03-01", amount: 99, description: "Tea", type: "debit", source: "whatsapp" };
    const a = await createTransactionOnce(userId, input, { source: "whatsapp", sourceRef: "wamid.x:txn:0" });
    const b = await createTransactionOnce(userId, input, { source: "whatsapp", sourceRef: "wamid.x:txn:0" });
    expect(a.created).toBe(true);
    expect(b).toMatchObject({ created: false, transaction: { id: a.transaction.id } });
    expect(await listTransactions(userId)).toHaveLength(1);
  });

  it("separate messages with identical amount and date are both recorded", async () => {
    const userId = await createUser();
    const input = { date: "2026-03-01", amount: 99, description: "Tea", type: "debit", source: "whatsapp" };
    await createTransactionOnce(userId, input, { source: "whatsapp", sourceRef: "wamid.a:txn:0" });
    await createTransactionOnce(userId, input, { source: "whatsapp", sourceRef: "wamid.b:txn:0" });
    expect(await listTransactions(userId)).toHaveLength(2);
  });

  it("retrying a failed reply does not repeat the financial write", async () => {
    const phone = "919800000004";
    const userId = await linkedUser(phone);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const [id] = await acceptInbound([msg("wamid.retry", phone, "salary 50000")]);
    const provider = scriptedProvider([
      { text: "", toolCalls: [{ id: "c", name: "record_transaction", input: { amount: 50000, direction: "income", description: "Salary" } }] },
      { text: "Saved.", toolCalls: [] },
    ]);
    expect(await processInbound(id, { provider })).toBe("processed");
    const [reply] = await db.select().from(whatsappOutboundMessages).where(eq(whatsappOutboundMessages.inboundId, id));

    // First send fails with a retryable error (mocked Graph API — no real message is sent).
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("upstream down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendOutbound(reply.id)).toBe("retry");
    // Retry after the backoff window.
    expect(await sendOutbound(reply.id, new Date(Date.now() + 10 * 60 * 1000))).toBe("sent");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/123/messages");
    expect(await listTransactions(userId)).toHaveLength(1);
    expect(provider.calls).toHaveLength(2); // orchestrator ran once (tool round + explanation)
  });

  it("replies to unlinked numbers without touching any account", async () => {
    const [id] = await acceptInbound([msg("wamid.unlinked", "919800000099", "spent 10")]);
    expect(await processInbound(id)).toBe("processed");
    const [reply] = await db.select().from(whatsappOutboundMessages).where(eq(whatsappOutboundMessages.inboundId, id));
    expect(reply.body).toMatch(/isn't linked/);
  });

  it("rate limits a flooding sender", async () => {
    process.env.WHATSAPP_RATE_LIMIT_MAX = "3";
    const phone = "919800000005";
    const ids = await acceptInbound(Array.from({ length: 5 }, (_, i) => msg(`wamid.flood.${i}`, phone, "hi")));
    expect(ids).toHaveLength(3);
    const limited = await db.select().from(whatsappInboundMessages).where(eq(whatsappInboundMessages.status, "rate_limited"));
    expect(limited).toHaveLength(2);
    delete process.env.WHATSAPP_RATE_LIMIT_MAX;
  });
});
