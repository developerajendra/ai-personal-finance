import "server-only";
import { z } from "zod";
import type { ToolDefinition } from "@/server/ai/contracts";
import { FinanceError } from "@/server/finance/common";
import {
  createInvestment,
  createInvestmentOnce,
  findInvestmentsByName,
  updateInvestment,
} from "@/server/finance/investments/service";
import {
  createTransaction,
  createTransactionOnce,
  getFinancialSummary,
  listTransactions,
} from "@/server/finance/transactions/service";
import { getPortfolioOverview } from "@/server/finance/reports/overview";
import { createReceivableOnce } from "@/server/finance/accounts/service";
import { INVESTMENT_STATUSES, INVESTMENT_TYPES } from "@/shared/schemas/finance";
import { formatIndianNumber } from "@/shared/utils/currency";

/**
 * Tools the model may request. The model never supplies the acting user:
 * `ToolContext.userId` always comes from the authenticated session or the
 * verified WhatsApp link.
 */
export interface ToolContext {
  userId: string;
  channel: "web" | "whatsapp";
  /** Source-specific message identity for idempotent writes (WhatsApp message id). */
  sourceRef?: string;
  today: string; // YYYY-MM-DD
}

export type ToolOutcome =
  | { kind: "result"; content: string; confirmation?: string; record?: { type: string; id: string; created: boolean } }
  | { kind: "clarify"; action: string; collected: Record<string, unknown>; missing: string[]; question: string }
  | { kind: "error"; content: string };

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
  z.number().finite().optional()
);
const optionalText = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(500).optional());
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()
);

// ─── Argument schemas (all fields optional; required ones are checked separately) ──

const recordTransactionArgs = z.object({
  amount: optionalNumber,
  direction: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(["expense", "income"]).optional()),
  description: optionalText,
  category: optionalText,
  date: optionalDate,
  account: optionalText,
});

const createInvestmentArgs = z.object({
  name: optionalText,
  amount: optionalNumber,
  investmentType: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(INVESTMENT_TYPES).optional()),
  startDate: optionalDate,
  maturityDate: optionalDate,
  interestRate: optionalNumber,
  description: optionalText,
});

const updateInvestmentArgs = z.object({
  investmentName: optionalText,
  amount: optionalNumber,
  interestRate: optionalNumber,
  maturityDate: optionalDate,
  startDate: optionalDate,
  status: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(INVESTMENT_STATUSES).optional()),
  description: optionalText,
});

const createReceivableArgs = z.object({
  personName: optionalText,
  amount: optionalNumber,
  issueDate: optionalDate,
  dueDate: optionalDate,
  interestRate: optionalNumber,
  description: optionalText,
});

const summaryArgs = z.object({ from: optionalDate, to: optionalDate });

const REQUIRED: Record<string, string[]> = {
  record_transaction: ["amount", "direction", "description"],
  create_investment: ["amount", "investmentType"],
  update_investment: ["investmentName"],
  create_receivable: ["personName", "amount"],
};

const FIELD_QUESTIONS: Record<string, string> = {
  amount: "the amount",
  direction: "whether it was an expense or income",
  description: "what it was for",
  investmentType: `the investment type (${INVESTMENT_TYPES.join(", ")})`,
  investmentName: "which investment to update",
  personName: "who you lent the money to",
};

export const WRITE_TOOLS = new Set(["record_transaction", "create_investment", "update_investment", "create_receivable"]);

export const FINANCE_TOOLS: ToolDefinition[] = [
  {
    name: "record_transaction",
    description:
      "Record an income or expense transaction for the user. Include ONLY values the user actually stated; omit anything unknown (the system will ask). Never invent an amount.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in INR, positive" },
        direction: { type: "string", enum: ["expense", "income"], description: "expense = money out, income = money in" },
        description: { type: "string", description: "What the transaction was for, e.g. 'Lunch at cafe'" },
        category: { type: "string", description: "Short category, e.g. food, travel, salary" },
        date: { type: "string", description: "YYYY-MM-DD; omit for today" },
        account: { type: "string", description: "Bank/account/card, if stated" },
      },
    },
  },
  {
    name: "create_investment",
    description:
      "Create a new DRAFT investment. Include ONLY values the user stated; omit unknown fields (the system will ask). Never invent an amount.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "e.g. 'HDFC Fixed Deposit'" },
        amount: { type: "number", description: "Invested amount in INR" },
        investmentType: { type: "string", enum: [...INVESTMENT_TYPES], description: "fd, ppf, mutual-fund, stocks, bonds or other" },
        startDate: { type: "string", description: "YYYY-MM-DD; omit for today" },
        maturityDate: { type: "string", description: "YYYY-MM-DD" },
        interestRate: { type: "number", description: "Annual rate in percent" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "update_investment",
    description: "Update fields of one of the user's existing investments, identified by name.",
    parameters: {
      type: "object",
      properties: {
        investmentName: { type: "string", description: "Name of the existing investment" },
        amount: { type: "number" },
        interestRate: { type: "number" },
        maturityDate: { type: "string", description: "YYYY-MM-DD" },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string", enum: [...INVESTMENT_STATUSES] },
        description: { type: "string" },
      },
    },
  },
  {
    name: "create_receivable",
    description:
      "Record money the user lent or gave to a person and expects back (personal lending) as a DRAFT receivable — use this instead of record_transaction for e.g. 'I gave 20k to Ishwari'. Include ONLY values the user stated; never invent an amount.",
    parameters: {
      type: "object",
      properties: {
        personName: { type: "string", description: "Who received the money, e.g. 'Ishwari'" },
        amount: { type: "number", description: "Amount lent in INR, positive" },
        issueDate: { type: "string", description: "YYYY-MM-DD the money was given; omit for today" },
        dueDate: { type: "string", description: "YYYY-MM-DD it is due back, if stated" },
        interestRate: { type: "number", description: "Agreed annual interest in percent, if stated" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "get_financial_overview",
    description:
      "Get verified totals of the user's published portfolio: net worth, total assets, loans, and assets by class (cash & bank, stocks & funds, retirement, properties, receivables, fixed deposits, other investments) — the same figures the dashboard shows. Net worth already includes receivables. Use for any question about totals or net worth and quote these numbers as-is.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_transaction_summary",
    description: "Get verified income/expense totals and category breakdown for a date range, plus the latest transactions.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD inclusive" },
        to: { type: "string", description: "YYYY-MM-DD inclusive" },
      },
    },
  },
  {
    name: "cancel_pending_action",
    description: "Cancel the action that is waiting for more details, when the user says to cancel or stop.",
    parameters: { type: "object", properties: {} },
  },
];

const rs = (n: number) => `Rs ${formatIndianNumber(n)}`;

function missingFields(tool: string, args: Record<string, unknown>): string[] {
  return (REQUIRED[tool] ?? []).filter((f) => args[f] === undefined || args[f] === null || args[f] === "");
}

export function clarificationQuestion(tool: string, missing: string[]): string {
  const what =
    tool === "record_transaction"
      ? "record this transaction"
      : tool === "create_investment"
        ? "create this investment"
        : tool === "create_receivable"
          ? "record this receivable"
          : "update the investment";
  const parts = missing.map((m) => FIELD_QUESTIONS[m] ?? m);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `To ${what} I still need ${list}. (Reply "cancel" to stop.)`;
}

function definedArgs(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/**
 * Validate and execute one tool call for the authenticated user.
 * `collected` carries fields gathered by an earlier clarification.
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
  options: { collected?: Record<string, unknown>; writeIndex?: number } = {}
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "record_transaction": {
        const parsed = recordTransactionArgs.safeParse(rawInput ?? {});
        if (!parsed.success) return { kind: "error", content: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
        const args = { ...(options.collected ?? {}), ...definedArgs(parsed.data) };
        const missing = missingFields(name, args);
        if (missing.length) return { kind: "clarify", action: name, collected: args, missing, question: clarificationQuestion(name, missing) };
        if (typeof args.amount !== "number" || args.amount <= 0) {
          return { kind: "clarify", action: name, collected: { ...args, amount: undefined }, missing: ["amount"], question: "The amount must be greater than 0. How much was it?" };
        }
        const input = {
          date: (args.date as string) ?? ctx.today,
          amount: args.amount,
          description: args.description,
          category: (args.category as string) ?? "uncategorized",
          type: args.direction === "income" ? "credit" : "debit",
          account: args.account,
          source: ctx.channel === "whatsapp" ? "whatsapp" : "chat",
        };
        const { transaction, created } = ctx.sourceRef
          ? await createTransactionOnce(ctx.userId, input, {
              source: input.source,
              sourceRef: `${ctx.sourceRef}:txn:${options.writeIndex ?? 0}`,
            })
          : { transaction: await createTransaction(ctx.userId, input), created: true };
        const kind = transaction.type === "credit" ? "Income" : "Expense";
        return {
          kind: "result",
          content: JSON.stringify({ saved: true, alreadyRecorded: !created, transaction }),
          record: { type: "transaction", id: transaction.id, created },
          confirmation: `${kind} recorded: ${rs(transaction.amount)} for ${transaction.description} on ${transaction.date.slice(0, 10)} (${transaction.category}).`,
        };
      }

      case "create_investment": {
        const parsed = createInvestmentArgs.safeParse(rawInput ?? {});
        if (!parsed.success) return { kind: "error", content: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
        const args = { ...(options.collected ?? {}), ...definedArgs(parsed.data) };
        const missing = missingFields(name, args);
        if (missing.length) return { kind: "clarify", action: name, collected: args, missing, question: clarificationQuestion(name, missing) };
        const type = args.investmentType as string;
        const input = {
          name: (args.name as string) ?? `New ${type.toUpperCase()}`,
          amount: args.amount,
          type,
          startDate: (args.startDate as string) ?? ctx.today,
          maturityDate: args.maturityDate,
          interestRate: args.interestRate,
          description: args.description,
          status: "active",
          tags: [ctx.channel === "whatsapp" ? "added from whatsapp" : "added from chat"],
        };
        const { investment, created } = ctx.sourceRef
          ? await createInvestmentOnce(
              ctx.userId,
              input,
              { source: ctx.channel, sourceRef: `${ctx.sourceRef}:inv:${options.writeIndex ?? 0}` },
              { isPublished: false }
            )
          : { investment: await createInvestment(ctx.userId, input, { isPublished: false }), created: true };
        return {
          kind: "result",
          content: JSON.stringify({ saved: true, draft: true, alreadyRecorded: !created, investment }),
          record: { type: "investment", id: investment.id, created },
          confirmation:
            `Draft investment saved: ${investment.name} — ${rs(investment.amount)} (${investment.type}), start ${investment.startDate.slice(0, 10)}` +
            `${investment.maturityDate ? `, matures ${investment.maturityDate.slice(0, 10)}` : ""}` +
            `${investment.interestRate !== undefined ? ` @ ${investment.interestRate}%` : ""}. Review and publish it in Portfolio → Investments.`,
        };
      }

      case "update_investment": {
        const parsed = updateInvestmentArgs.safeParse(rawInput ?? {});
        if (!parsed.success) return { kind: "error", content: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
        const args = { ...(options.collected ?? {}), ...definedArgs(parsed.data) };
        const missing = missingFields(name, args);
        if (missing.length) return { kind: "clarify", action: name, collected: args, missing, question: clarificationQuestion(name, missing) };
        const matches = await findInvestmentsByName(ctx.userId, args.investmentName as string);
        if (matches.length === 0) {
          return { kind: "error", content: `No investment named "${args.investmentName}" was found. Ask the user which investment they mean.` };
        }
        if (matches.length > 1) {
          return {
            kind: "error",
            content: `Several investments match "${args.investmentName}": ${matches.map((m) => m.name).join("; ")}. Ask the user to choose one.`,
          };
        }
        const { investmentName: _name, ...patch } = args;
        if (Object.keys(patch).length === 0) {
          return { kind: "error", content: "No fields to update were given. Ask the user what to change." };
        }
        const updated = await updateInvestment(ctx.userId, matches[0].id, patch);
        return {
          kind: "result",
          content: JSON.stringify({ saved: true, investment: updated }),
          record: { type: "investment", id: updated.id, created: false },
          confirmation: `Investment updated: ${updated.name} — ${Object.keys(patch).join(", ")} changed.`,
        };
      }

      case "create_receivable": {
        const parsed = createReceivableArgs.safeParse(rawInput ?? {});
        if (!parsed.success) return { kind: "error", content: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
        const args = { ...(options.collected ?? {}), ...definedArgs(parsed.data) };
        const missing = missingFields(name, args);
        if (missing.length) return { kind: "clarify", action: name, collected: args, missing, question: clarificationQuestion(name, missing) };
        if (typeof args.amount !== "number" || args.amount <= 0) {
          return { kind: "clarify", action: name, collected: { ...args, amount: undefined }, missing: ["amount"], question: "The amount must be greater than 0. How much did you lend?" };
        }
        const issueDate = (args.issueDate as string) ?? ctx.today;
        const { receivable, created } = await createReceivableOnce(
          ctx.userId,
          {
            bankName: args.personName,
            accountType: "other",
            balance: args.amount,
            issueDate,
            dueDate: args.dueDate,
            interestRate: args.interestRate,
            description: args.description,
            lastUpdated: issueDate,
          },
          { channel: ctx.channel, sourceRef: ctx.sourceRef ? `${ctx.sourceRef}:recv:${options.writeIndex ?? 0}` : undefined }
        );
        return {
          kind: "result",
          content: JSON.stringify({ saved: true, draft: true, alreadyRecorded: !created, receivable }),
          record: { type: "receivable", id: receivable.id, created },
          confirmation:
            `Draft receivable saved: ${rs(receivable.balance)} lent to ${receivable.bankName} on ${issueDate}` +
            `${receivable.dueDate ? `, due ${receivable.dueDate.slice(0, 10)}` : ""}` +
            `${receivable.interestRate ? ` @ ${receivable.interestRate}%` : ""}. Review and publish it in Portfolio → Receivables.`,
        };
      }

      case "get_financial_overview":
        return { kind: "result", content: JSON.stringify(await getPortfolioOverview(ctx.userId)) };

      case "get_transaction_summary": {
        const parsed = summaryArgs.safeParse(rawInput ?? {});
        if (!parsed.success) return { kind: "error", content: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
        const [summary, recent] = await Promise.all([
          getFinancialSummary(ctx.userId, parsed.data),
          listTransactions(ctx.userId, parsed.data),
        ]);
        return {
          kind: "result",
          content: JSON.stringify({ range: parsed.data, summary, latest: recent.slice(0, 10) }),
        };
      }

      default:
        return { kind: "error", content: `Unknown tool: ${name}` };
    }
  } catch (error) {
    if (error instanceof FinanceError) return { kind: "error", content: error.message };
    throw error;
  }
}
