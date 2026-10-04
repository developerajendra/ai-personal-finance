import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type ChatContext } from "@/server/ai/orchestrator/prompts";

const base: ChatContext = {
  transactions: [],
  summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0, categoryBreakdown: {} },
  categories: [],
};

const build = (context: ChatContext, channel: "web" | "whatsapp" = "web") =>
  buildSystemPrompt({ context, channel, supportsTools: true, today: "2026-10-04", clarification: null });

describe("assistant system prompt", () => {
  it("limits every channel to finance questions and drops the audit agent", () => {
    for (const channel of ["web", "whatsapp"] as const) {
      const prompt = build(base, channel);
      expect(prompt).toMatch(/SCOPE — FINANCE ONLY/);
      expect(prompt).toMatch(/do not answer it/i);
      expect(prompt).not.toMatch(/AUDIT/);
    }
  });

  it("includes receivables, EPF passbooks, subscriptions and this month's budget", () => {
    const prompt = build({
      ...base,
      receivables: [{ id: "r1", bankName: "Amit", balance: 200000, interestRate: 8, dueDate: "2026-08-01", tags: ["receivable"] } as any],
      ppfAccounts: [{ id: "p1", establishmentName: "TTN", grandTotal: 450000, depositEmployeeShare: 200000, depositEmployerShare: 150000, pensionContribution: 50000 } as any],
      subscriptions: [{ id: "s1", name: "Claude", plan: "Pro", amount: 20, currency: "USD", cycle: "Monthly", nextDate: "2026-10-20", ends: false, status: "Active" } as any],
      budget: {
        month: "2026-10",
        items: [{ id: "b1", kind: "expense", name: "Rent", category: "Home", costType: "fixed", frequency: "monthly", amount: 30000, active: true } as any],
        entries: [{ id: "e1", itemId: "b1", month: "2026-10", amount: 30000, date: "2026-10-01" } as any],
      },
    });
    expect(prompt).toContain("RECEIVABLES");
    expect(prompt).toContain(`Amit: Rs ${(200000).toLocaleString()}`);
    expect(prompt).toContain("EPF PASSBOOKS");
    expect(prompt).toContain("Claude (Pro): USD 20 monthly, renews 2026-10-20");
    expect(prompt).toContain("BUDGET for 2026-10");
    expect(prompt).toContain(`logged this month Rs ${(30000).toLocaleString()}`);
  });
});
