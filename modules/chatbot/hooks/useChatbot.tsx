"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ChatMessage } from "@/shared/types";

interface ChatbotContextType {
  isOpen: boolean;
  messages: ChatMessage[];
  openChatbot: () => void;
  closeChatbot: () => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

/** Open state and the running conversation for the floating Personal Finance AI chat, shared across pages. */
export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const openChatbot = () => setIsOpen(true);
  const closeChatbot = () => setIsOpen(false);
  const addMessage = (message: ChatMessage) => setMessages((prev) => [...prev, message]);
  const clearMessages = () => setMessages([]);

  return (
    <ChatbotContext.Provider value={{ isOpen, messages, openChatbot, closeChatbot, addMessage, clearMessages }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error("useChatbot must be used within a ChatbotProvider");
  }
  return context;
}
