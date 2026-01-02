"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ChatMessage } from "@/core/types";

interface ChatbotContextType {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  openChatbot: () => void;
  closeChatbot: () => void;
  minimizeChatbot: () => void;
  expandChatbot: () => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const openChatbot = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const closeChatbot = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const minimizeChatbot = () => {
    setIsMinimized(true);
  };

  const expandChatbot = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        isMinimized,
        messages,
        openChatbot,
        closeChatbot,
        minimizeChatbot,
        expandChatbot,
        addMessage,
        clearMessages,
      }}
    >
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

