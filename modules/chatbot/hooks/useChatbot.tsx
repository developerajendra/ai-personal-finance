"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ChatMessage } from "@/core/types";

export interface AuditData {
  tableHtml: string;
  source: string;
  message: string;
}

interface ChatbotContextType {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  pendingAuditData: AuditData | null;
  openChatbot: () => void;
  closeChatbot: () => void;
  minimizeChatbot: () => void;
  expandChatbot: () => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  sendAuditData: (data: AuditData) => void;
  clearPendingAuditData: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAuditData, setPendingAuditData] = useState<AuditData | null>(null);

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

  const sendAuditData = (data: AuditData) => {
    setPendingAuditData(data);
    setIsOpen(true);
    setIsMinimized(false);
  };

  const clearPendingAuditData = () => {
    setPendingAuditData(null);
  };

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        isMinimized,
        messages,
        pendingAuditData,
        openChatbot,
        closeChatbot,
        minimizeChatbot,
        expandChatbot,
        addMessage,
        clearMessages,
        sendAuditData,
        clearPendingAuditData,
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

