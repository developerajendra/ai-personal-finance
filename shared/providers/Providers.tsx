"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ChatbotProvider } from "@/modules/chatbot/hooks/useChatbot";
import { ChatbotIcon } from "@/modules/chatbot/components/ChatbotIcon";
import { ChatbotBoard } from "@/modules/chatbot/components/ChatbotBoard";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ChatbotProvider>
        {children}
        <ChatbotIcon />
        <ChatbotBoard />
      </ChatbotProvider>
    </QueryClientProvider>
  );
}

