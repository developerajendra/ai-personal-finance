"use client";

import { MessageSquare } from "lucide-react";
import { useChatbot } from "../hooks/useChatbot";

export function ChatbotIcon() {
  const { openChatbot, isOpen } = useChatbot();

  if (isOpen) return null;

  return (
    <button
      onClick={openChatbot}
      className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
      title="Open AI Assistant"
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  );
}

