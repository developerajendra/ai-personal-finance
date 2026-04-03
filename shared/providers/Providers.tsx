"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { ChatbotProvider } from "@/modules/chatbot/hooks/useChatbot";
import { ChatbotIcon } from "@/modules/chatbot/components/ChatbotIcon";
import { ChatbotBoard } from "@/modules/chatbot/components/ChatbotBoard";
import { SessionGate } from "@/shared/components/SessionGate";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ChatbotProvider>
          <SessionGate>
            {children}
            <ChatbotIcon />
            <ChatbotBoard />
          </SessionGate>
        </ChatbotProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
