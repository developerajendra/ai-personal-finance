import { webChatPOST } from "@/server/ai/webChatHandler";

// Legacy URL kept for existing clients; same handler as /api/chat.
export const POST = webChatPOST;
