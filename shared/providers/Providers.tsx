"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { ChatbotProvider } from "@/modules/chatbot/hooks/useChatbot";
import { ChatbotIcon } from "@/modules/chatbot/components/ChatbotIcon";
import { ChatbotHost } from "@/modules/chatbot/components/ChatbotHost";
import { SessionGate } from "@/shared/components/SessionGate";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";
import { AppFrame } from "@/shared/components/AppShell";

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
        <ThemeProvider>
          <ChatbotProvider>
            <SessionGate>
              <AppFrame>{children}</AppFrame>
              <ChatbotIcon />
              <ChatbotHost />
            </SessionGate>
          </ChatbotProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
