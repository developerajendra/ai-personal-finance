import "server-only";
import type { LLMProvider, ProviderMessage, ToolCall, ToolResult } from "@/server/ai/contracts";
import { getProvider } from "@/server/ai/providers";
import {
  appendExchange,
  bumpClarificationAttempt,
  closeClarification,
  getOpenClarification,
  getOrCreateConversation,
  openClarification,
  recentMessages,
  type Channel,
  type Clarification,
} from "@/server/ai/conversations/store";
import { FINANCE_TOOLS, WRITE_TOOLS, executeTool, type ToolContext } from "@/server/ai/tools/financeTools";
import { buildSystemPrompt, type ChatContext } from "./prompts";
import { loadMutualFunds, loadPortfolio, loadStocks } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { listSubscriptions } from "@/server/finance/subscriptions/service";
import { getBudget } from "@/server/finance/budget/service";
import { isSettledReceivable } from "@/shared/utils/receivables";
import { summarizeTransactions } from "@/server/finance/transactions/service";

/**
 * The single conversational entry point for web chat and WhatsApp.
 *
 * Responsibilities: load user-scoped history and any pending clarification,
 * let the model interpret the message, validate and execute requested tools
 * as the authenticated user, persist the exchange, and return the reply.
 * Financial writes happen only inside finance services; the model cannot pick
 * the acting user or bypass validation.
 */

export interface OrchestratorInput {
  userId: string;
  channel: Channel;
  message: string;
  conversationId?: string | null;
  /** Source-specific identity of the inbound message (WhatsApp message id). */
  sourceRef?: string;
}

export interface ActionRecord {
  tool: string;
  status: "saved" | "clarification" | "error" | "cancelled";
  recordType?: string;
  recordId?: string;
  created?: boolean;
}

export interface OrchestratorOutput {
  conversationId: string;
  reply: string;
  actions: ActionRecord[];
  provider: { id: string; model: string };
}

export interface OrchestratorDeps {
  provider?: LLMProvider;
  now?: () => Date;
}

const MAX_TOOL_ROUNDS = 3;
const CANCEL_PATTERN = /^\s*(cancel|stop|never ?mind|forget it|abort)\s*[.!]*\s*$/i;

async function loadChatContext(userId: string, now: Date): Promise<ChatContext> {
  const month = now.toISOString().slice(0, 7);
  // Optional areas degrade to empty rather than failing the whole reply (e.g. a database
  // that hasn't had the budget migration yet)
  const soft = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => (console.warn("[Chat] context section unavailable:", e?.message ?? e), fallback));
  const [portfolio, stocks, mutualFunds, ppfAccounts, subscriptions, budget] = await Promise.all([
    loadPortfolio(userId),
    loadStocks(userId),
    loadMutualFunds(userId),
    soft(loadPPFAccounts(userId), []),
    soft(listSubscriptions(userId), []),
    soft(getBudget(userId, month), { items: [], entries: [] }),
  ]);
  const published = portfolio.bankBalances.filter((b) => b.isPublished === true);
  // The assistant reasons over published data, as the dashboard does.
  return {
    transactions: portfolio.transactions,
    summary: summarizeTransactions(portfolio.transactions),
    categories: Array.from(new Set(portfolio.transactions.map((t) => t.category))),
    investments: portfolio.investments.filter((i) => i.isPublished === true),
    loans: portfolio.loans.filter((l) => l.isPublished === true),
    properties: portfolio.properties.filter((p) => p.isPublished === true),
    bankBalances: published.filter((b) => !b.tags?.includes("receivable")),
    receivables: published.filter((b) => b.tags?.includes("receivable") && !isSettledReceivable(b)),
    stocks,
    mutualFunds,
    ppfAccounts,
    subscriptions,
    budget: { month, ...budget },
  };
}

/** Parse the legacy `<action>{json}</action>` protocol used by text-only providers. */
export function parseLegacyActions(text: string): { cleaned: string; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  const re = /<action>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    try {
      const parsed = JSON.parse(match[1]) as { type?: string; data?: Record<string, unknown> };
      if (!parsed.type) continue;
      const input: Record<string, unknown> = { ...(parsed.data ?? {}) };
      if (parsed.type === "create_investment" && "type" in input) {
        input.investmentType = input.type;
        delete input.type;
      }
      calls.push({ id: `legacy-${i++}`, name: parsed.type, input });
    } catch {
      // Malformed action JSON is ignored; nothing is written.
    }
  }
  return { cleaned: text.replace(re, "").trim(), calls };
}

export async function handleMessage(input: OrchestratorInput, deps: OrchestratorDeps = {}): Promise<OrchestratorOutput> {
  const now = deps.now?.() ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const provider = deps.provider ?? getProvider("chat");
  const conversationId = await getOrCreateConversation(input.userId, input.channel, input.conversationId, now);
  const actions: ActionRecord[] = [];
  const confirmations: string[] = [];

  let clarification: Clarification | null = await getOpenClarification(conversationId, input.userId, now);

  const finish = async (reply: string): Promise<OrchestratorOutput> => {
    await appendExchange(conversationId, input.userId, input.message, reply, {
      provider: provider.id,
      model: provider.model,
      actions,
      ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    }, now);
    return { conversationId, reply, actions, provider: { id: provider.id, model: provider.model } };
  };

  // Deterministic cancel: never needs the model.
  if (clarification && CANCEL_PATTERN.test(input.message)) {
    await closeClarification(clarification.id, "cancelled");
    actions.push({ tool: clarification.action, status: "cancelled" });
    return finish("Okay, I've cancelled that. Nothing was saved.");
  }

  const [history, context] = await Promise.all([
    recentMessages(conversationId, input.userId),
    loadChatContext(input.userId, now),
  ]);
  const system = buildSystemPrompt({
    context,
    channel: input.channel,
    supportsTools: provider.supportsTools,
    today,
    clarification,
  });
  const messages: ProviderMessage[] = [
    ...history.map((m): ProviderMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: input.message },
  ];
  const toolCtx: ToolContext = { userId: input.userId, channel: input.channel, sourceRef: input.sourceRef, today };
  const writeCounters = new Map<string, number>();

  let finalText = "";
  let usedTool = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await provider.generate({
      system,
      messages,
      tools: provider.supportsTools ? FINANCE_TOOLS : undefined,
    });

    let calls = response.toolCalls;
    let text = response.text;
    if (!provider.supportsTools) {
      const legacy = parseLegacyActions(text);
      calls = legacy.calls;
      text = legacy.cleaned;
    }

    if (calls.length === 0) {
      finalText = text;
      break;
    }
    usedTool = true;

    const results: ToolResult[] = [];
    for (const call of calls) {
      if (call.name === "cancel_pending_action") {
        if (clarification) {
          await closeClarification(clarification.id, "cancelled");
          actions.push({ tool: clarification.action, status: "cancelled" });
          clarification = null;
        }
        results.push({ toolCallId: call.id, name: call.name, content: JSON.stringify({ cancelled: true }) });
        continue;
      }

      // Fields gathered by an open clarification for the same action are merged in.
      const collected = clarification && clarification.action === call.name ? clarification.collectedFields : undefined;
      const writeIndex = writeCounters.get(call.name) ?? 0;
      if (WRITE_TOOLS.has(call.name)) writeCounters.set(call.name, writeIndex + 1);

      const outcome = await executeTool(call.name, call.input, toolCtx, { collected, writeIndex });

      if (outcome.kind === "clarify") {
        // Ask deterministically; the question is grounded in validation, not model text.
        await openClarification(conversationId, input.userId, outcome.action, outcome.collected, outcome.missing, now);
        actions.push({ tool: call.name, status: "clarification" });
        const prefix = confirmations.length ? `${confirmations.join("\n")}\n\n` : "";
        return finish(`${prefix}${outcome.question}`);
      }

      if (outcome.kind === "error") {
        actions.push({ tool: call.name, status: "error" });
        results.push({ toolCallId: call.id, name: call.name, content: outcome.content, isError: true });
        continue;
      }

      if (outcome.record) {
        actions.push({
          tool: call.name,
          status: "saved",
          recordType: outcome.record.type,
          recordId: outcome.record.id,
          created: outcome.record.created,
        });
        if (clarification && clarification.action === call.name) {
          await closeClarification(clarification.id, "resolved");
          clarification = null;
        }
      }
      if (outcome.confirmation) confirmations.push(outcome.confirmation);
      results.push({ toolCallId: call.id, name: call.name, content: outcome.content });
    }

    if (!provider.supportsTools) {
      // Text-only providers get no second pass; their text already answers.
      finalText = text;
      if (results.some((r) => r.isError)) {
        finalText += `\n\n${results.filter((r) => r.isError).map((r) => r.content).join("\n")}`;
      }
      break;
    }

    messages.push({ role: "assistant", content: text, toolCalls: calls });
    messages.push({ role: "tool", results });
    finalText = text;
  }

  // A clarification left open while the user talked about something else
  // counts as an attempt; after a few it expires.
  if (clarification && !usedTool) await bumpClarificationAttempt(clarification.id, clarification.attempts);

  // Confirmations are generated from committed records, never from model text.
  const confirmationBlock = confirmations.length ? `\n\n${confirmations.map((c) => `✅ ${c}`).join("\n")}` : "";
  const reply = (finalText.trim() || (confirmations.length ? "Done." : "Sorry, I couldn't work that out. Could you rephrase?")) + confirmationBlock;
  return finish(reply.trim());
}
