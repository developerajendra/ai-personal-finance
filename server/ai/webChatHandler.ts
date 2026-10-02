import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { handleMessage } from "@/server/ai/orchestrator";
import { generateText } from "@/server/ai/providers";
import { ProviderConfigurationError } from "@/server/ai/contracts";
import {
  auditScrapedPageData,
  auditWithScreenshot,
  callAuditAgent,
  detectAuditIntent,
  extractAuditUrl,
} from "@/server/integrations/finance-audit/mcpAuditService";

const MAX_MESSAGE_LENGTH = 4000;

/**
 * POST handler for web chat (served at /api/chat and the legacy
 * /api/modules/chatbot/message URL). Thin: auth, parse, delegate.
 */
export async function webChatPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const body = await request.json();
    const { message, agent, currentPage, pageData, screenshot, conversationId } = body ?? {};

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 });
    }

    // Finance calculator audit: selected via dropdown OR auto-detected (unchanged behaviour).
    const isAuditAgent = agent === "audit-finance";
    const auditRequest = isAuditAgent ? extractAuditUrl(message) : detectAuditIntent(message);

    if (auditRequest) {
      console.log(`[Chatbot] Routing to audit agent for: ${auditRequest.url}`);
      try {
        const auditResult = await callAuditAgent(auditRequest);
        const rephrasePrompt = `You are a helpful financial assistant. The user asked to audit a finance calculator. Here are the raw audit results from our Finance Audit Agent:

${auditResult}

Please rephrase these findings in a friendly, conversational tone. Important rules:
- Never claim 100% certainty - use phrases like "it appears", "I noticed", "there might be"
- Highlight the most important issues first
- Keep it concise but informative
- Use markdown formatting for readability
- End with a brief recommendation

User's original message: "${message}"`;
        return NextResponse.json({ response: await generateText("chat", rephrasePrompt) });
      } catch (auditError: any) {
        console.error("[Chatbot] Audit failed:", auditError);
        return NextResponse.json({
          response: `I tried to audit the calculator at ${auditRequest.url}, but encountered an error: ${auditError.message || "Unknown error"}. This might happen if the page requires special access, uses complex dynamic loading, or if the audit agent service is not available. You can try again or provide a different URL.`,
        });
      }
    }

    if (isAuditAgent) {
      const pagePath = currentPage || "/dashboard";

      // Priority 1: vision-first audit via screenshot.
      if (screenshot && typeof screenshot === "string" && screenshot.length > 100) {
        try {
          return NextResponse.json({ response: await auditWithScreenshot(message, screenshot, pagePath) });
        } catch (auditError) {
          console.error("[Chatbot] Visual audit failed, falling back to DOM data:", auditError);
        }
      }

      // Priority 2: DOM-scraped data.
      const hasTableData = pageData?.tables?.length > 0 && pageData.tables.some((t: any) => t.rows?.length > 0);
      const hasSummaryCards = pageData?.summaryCards?.length > 0;
      if (pageData && (hasTableData || hasSummaryCards)) {
        try {
          return NextResponse.json({ response: await auditScrapedPageData(message, pageData, pagePath) });
        } catch (auditError: any) {
          console.error("[Chatbot] Page data audit failed:", auditError);
          return NextResponse.json({
            response: `I encountered an error while auditing the data on \`${pagePath}\`: ${auditError.message || "Unknown error"}. Please try again.`,
          });
        }
      }

      return NextResponse.json({
        response: `No financial data found on the current page (\`${pagePath}\`). Please navigate to a page with financial data (e.g., Portfolio, Investments, Loans, Stocks) and try again.`,
      });
    }

    // Context is always loaded server-side for the session user; any
    // client-supplied `context` is ignored.
    const result = await handleMessage({
      userId,
      channel: "web",
      message,
      conversationId: typeof conversationId === "string" ? conversationId : null,
    });

    return NextResponse.json({
      response: result.reply,
      conversationId: result.conversationId,
      actions: result.actions,
    });
  } catch (error: any) {
    if (error instanceof ProviderConfigurationError) {
      console.error("[Chatbot] AI provider not configured:", error.message);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // Provider SDKs expose the upstream HTTP status; 401/403 means bad credentials.
    if (error?.status === 401 || error?.status === 403) {
      console.error("[Chatbot] AI provider rejected credentials:", error.message);
      return NextResponse.json(
        { error: "The AI provider rejected the API key. Check the key configured for the chat provider." },
        { status: 502 }
      );
    }
    console.error("Chatbot API error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
