import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { handleMessage } from "@/server/ai/orchestrator";
import { ProviderConfigurationError } from "@/server/ai/contracts";

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
    const { message, conversationId } = body ?? {};

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 });
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
