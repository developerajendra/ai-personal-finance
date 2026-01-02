"use client";

import { useState, useRef, useEffect } from "react";
import { useChatbot } from "../hooks/useChatbot";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/core/types";
import { sendChatMessage } from "@/core/services/geminiService";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatChart } from "./ChatChart";

export function ChatbotBoard() {
  const {
    isOpen,
    isMinimized,
    closeChatbot,
    minimizeChatbot,
    expandChatbot,
    messages,
    addMessage,
  } = useChatbot();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { transactions, summary, categories } = useFinancialData();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/modules/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context: {
            transactions,
            summary,
            categories,
          },
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">AI Assistant</h3>
          <div className="flex gap-2">
            <button
              onClick={expandChatbot}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeChatbot}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">AI Financial Assistant</h3>
        <div className="flex gap-2">
          <button
            onClick={minimizeChatbot}
            className="p-1 hover:bg-gray-100 rounded"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/chatbot")}
            className="p-1 hover:bg-gray-100 rounded"
            title="Full Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={closeChatbot}
            className="p-1 hover:bg-gray-100 rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>Ask me anything about your finances!</p>
            <p className="text-sm mt-2">Try: "Give me a financial summary" or "What are my investments?"</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {message.role === "assistant" ? (
                <div>
                  {(() => {
                    // Parse chart data from <chart> tags
                    const chartRegex = /<chart>(.*?)<\/chart>/gs;
                    const charts: any[] = [];
                    let processedContent = message.content;
                    let match;
                    let chartIndex = 0;

                    while ((match = chartRegex.exec(message.content)) !== null) {
                      try {
                        const chartData = JSON.parse(match[1]);
                        charts.push(chartData);
                        // Replace chart tag with placeholder
                        processedContent = processedContent.replace(
                          match[0],
                          `__CHART_PLACEHOLDER_${chartIndex}__`
                        );
                        chartIndex++;
                      } catch (e) {
                        console.error("Error parsing chart data:", e);
                      }
                    }

                    // Split content by chart placeholders
                    const parts = processedContent.split(/(__CHART_PLACEHOLDER_\d+__)/);
                    let currentChartIndex = 0;

                    return (
                      <>
                        {parts.map((part, index) => {
                          if (part.match(/__CHART_PLACEHOLDER_\d+__/)) {
                            const chart = charts[currentChartIndex];
                            currentChartIndex++;
                            return chart ? <ChatChart key={`chart-${index}`} chartData={chart} /> : null;
                          }
                          return (
                            <ReactMarkdown
                              key={`text-${index}`}
                              remarkPlugins={[remarkGfm]}
                              className="prose prose-sm max-w-none"
                            >
                              {part}
                            </ReactMarkdown>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your finances..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

