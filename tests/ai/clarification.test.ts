import { describe, expect, it } from "vitest";
import { createUser, scriptedProvider } from "../helpers";
import { handleMessage, parseLegacyActions } from "@/server/ai/orchestrator";
import { listTransactions } from "@/server/finance/transactions/service";
import { listInvestments } from "@/server/finance/investments/service";
import { bankBalanceService } from "@/server/finance/accounts/service";

describe("conversation clarification", () => {
  it("asks for a missing amount, then saves once it arrives", async () => {
    const user = await createUser();
    const provider = scriptedProvider([
      // Turn 1: model calls the tool without an amount.
      { text: "", toolCalls: [{ id: "c1", name: "record_transaction", input: { direction: "expense", description: "Lunch", category: "food" } }] },
      // Turn 2: model supplies only the amount; description comes from the clarification.
      { text: "", toolCalls: [{ id: "c2", name: "record_transaction", input: { amount: 450 } }] },
      { text: "Saved your lunch expense.", toolCalls: [] },
    ]);

    const first = await handleMessage({ userId: user, channel: "web", message: "I had lunch" }, { provider });
    expect(first.reply).toMatch(/still need the amount/i);
    expect(first.actions).toEqual([{ tool: "record_transaction", status: "clarification" }]);
    expect(await listTransactions(user)).toHaveLength(0);

    const second = await handleMessage(
      { userId: user, channel: "web", message: "450", conversationId: first.conversationId },
      { provider }
    );
    const txns = await listTransactions(user);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ amount: 450, description: "Lunch", category: "food", type: "debit", source: "chat" });
    expect(second.reply).toContain("Expense recorded: Rs 450");
    // The pending action was surfaced to the model on the follow-up turn.
    expect(provider.calls[1].system).toContain("PENDING ACTION");
  });

  it("cancels a pending action without calling the model", async () => {
    const user = await createUser();
    const provider = scriptedProvider([
      { text: "", toolCalls: [{ id: "c1", name: "create_investment", input: { name: "SBI FD" } }] },
    ]);
    const first = await handleMessage({ userId: user, channel: "whatsapp", message: "add SBI FD" }, { provider });
    expect(first.reply).toMatch(/amount/);
    const second = await handleMessage(
      { userId: user, channel: "whatsapp", message: "cancel", conversationId: first.conversationId },
      { provider }
    );
    expect(second.reply).toMatch(/cancelled/i);
    expect(provider.calls).toHaveLength(1);
    expect(await listInvestments(user)).toHaveLength(0);
  });

  it("never lets the model choose the acting user", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const provider = scriptedProvider([
      { text: "", toolCalls: [{ id: "c1", name: "record_transaction", input: { amount: 10, direction: "income", description: "x", userId: bob } }] },
      { text: "done", toolCalls: [] },
    ]);
    await handleMessage({ userId: alice, channel: "web", message: "got 10" }, { provider });
    expect(await listTransactions(alice)).toHaveLength(1);
    expect(await listTransactions(bob)).toHaveLength(0);
  });

  it("reports validation errors back to the model instead of saving", async () => {
    const user = await createUser();
    const provider = scriptedProvider([
      { text: "", toolCalls: [{ id: "c1", name: "record_transaction", input: { amount: -5, direction: "expense", description: "x" } }] },
    ]);
    const out = await handleMessage({ userId: user, channel: "web", message: "spent -5" }, { provider });
    expect(out.reply).toMatch(/greater than 0/);
    expect(await listTransactions(user)).toHaveLength(0);
  });

  it("saves money lent to a person as a draft receivable, not an expense", async () => {
    const user = await createUser();
    const provider = scriptedProvider([
      { text: "", toolCalls: [{ id: "c1", name: "create_receivable", input: { personName: "Ishwari", amount: 20000, issueDate: "2026-09-15" } }] },
      { text: "Saved as a draft receivable.", toolCalls: [] },
    ]);
    const out = await handleMessage({ userId: user, channel: "web", message: "i gave 20k to ishwari on 15th of september" }, { provider });
    const [recv, ...rest] = await bankBalanceService.list(user);
    expect(rest).toHaveLength(0);
    expect(recv).toMatchObject({ bankName: "Ishwari", balance: 20000, issueDate: "2026-09-15", isPublished: false });
    expect(recv.tags).toContain("receivable");
    expect(await listTransactions(user)).toHaveLength(0);
    expect(out.reply).toContain("Portfolio → Receivables");
  });

  it("records a WhatsApp receivable once per message", async () => {
    const user = await createUser();
    const call = { text: "", toolCalls: [{ id: "c1", name: "create_receivable", input: { personName: "Ravi", amount: 5000 } }] };
    const provider = scriptedProvider([call, { text: "ok", toolCalls: [] }, call, { text: "ok", toolCalls: [] }]);
    await handleMessage({ userId: user, channel: "whatsapp", message: "lent ravi 5000", sourceRef: "wamid.1" }, { provider });
    await handleMessage({ userId: user, channel: "whatsapp", message: "lent ravi 5000", sourceRef: "wamid.1" }, { provider });
    expect(await bankBalanceService.list(user)).toHaveLength(1);
  });

  it("keeps the legacy <action> protocol for text-only providers", () => {
    const { cleaned, calls } = parseLegacyActions(
      'Sure!<action>{"type":"create_investment","data":{"name":"PPF","amount":500,"type":"ppf"}}</action>'
    );
    expect(cleaned).toBe("Sure!");
    expect(calls[0]).toMatchObject({ name: "create_investment", input: { name: "PPF", amount: 500, investmentType: "ppf" } });
  });

  it("persists history independent of provider format", async () => {
    const user = await createUser();
    const provider = scriptedProvider([{ text: "Your net worth is ...", toolCalls: [] }]);
    const first = await handleMessage({ userId: user, channel: "web", message: "net worth?" }, { provider });
    await handleMessage({ userId: user, channel: "web", message: "and loans?", conversationId: first.conversationId }, { provider });
    const secondCallMessages = provider.calls[1].messages;
    expect(secondCallMessages.slice(0, 2)).toEqual([
      { role: "user", content: "net worth?" },
      { role: "assistant", content: "Your net worth is ..." },
    ]);
  });
});
