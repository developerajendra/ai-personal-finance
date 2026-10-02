"use client";

import { useState, useRef, useEffect } from "react";
import { useChatbot } from "../hooks/useChatbot";
import { X, Minimize2, Maximize2, Mic, MicOff } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ChatMessage } from "@/shared/types";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatChart } from "./ChatChart";
import { VoiceModeView } from "./VoiceModeView";
import { scrapeCurrentPage } from "../utils/scrapePageData";
import { capturePageScreenshot } from "../utils/captureScreenshot";

export function ChatbotBoard() {
  const {
    isOpen,
    isMinimized,
    closeChatbot,
    minimizeChatbot,
    expandChatbot,
    messages,
    addMessage,
    pendingAuditData,
    clearPendingAuditData,
  } = useChatbot();
  // Server-side conversation id so follow-up answers (e.g. a missing amount)
  // resolve against the same thread; reset when the chat is cleared.
  const conversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) conversationIdRef.current = null;
  }, [messages.length]);
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [operationPrefix, setOperationPrefix] = useState<string>(""); // Track selected operation
  const [selectedAgent, setSelectedAgent] = useState<"ask" | "audit-finance">("ask"); // Agent selector
  const [agentStatus, setAgentStatus] = useState<"idle" | "connecting" | "connected" | "failed">("idle"); // MCP connection status
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false); // Track if we're in voice conversation mode
  const [currentTranscript, setCurrentTranscript] = useState(""); // Track current voice transcript
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isVoiceInputRef = useRef(false); // Track if current input came from voice
  const isVoiceModeRef = useRef(false); // Ref to track voice mode for callbacks
  const isLoadingRef = useRef(false); // Ref to track loading state for callbacks
  const { transactions, summary, categories } = useFinancialData();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Handle pending audit data from external components (e.g., Audit button on Loans table)
  useEffect(() => {
    if (!pendingAuditData || isLoading) return;

    const processAuditData = async () => {
      // Auto-switch to audit-finance agent
      setSelectedAgent("audit-finance");
      setAgentStatus("connecting");
      try {
        const res = await fetch("/api/modules/chatbot/audit-health");
        const data = await res.json();
        setAgentStatus(data.connected ? "connected" : "failed");
      } catch {
        setAgentStatus("failed");
      }

      // Add the user message (visible in chat)
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: pendingAuditData.message,
        timestamp: new Date(),
      };
      addMessage(userMessage);
      setIsLoading(true);

      try {
        const response = await fetch("/api/modules/chatbot/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          conversationId: conversationIdRef.current,
            message: pendingAuditData.message,
            agent: "audit-finance",
            currentPage: pathname,
            pageData: {
              pageTitle: document.title || "",
              pageUrl: pathname,
              pageHeading: `Audit - ${pendingAuditData.source}`,
              tables: [],
              summaryCards: [],
              rawHtml: pendingAuditData.tableHtml,
            },
            context: {
              transactions,
              summary,
              categories,
            },
          }),
        });

        const data = await response.json();
      if (data.conversationId) conversationIdRef.current = data.conversationId;
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        addMessage(assistantMessage);
      } catch (error) {
        console.error("Error sending audit message:", error);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error while auditing the data. Please try again.",
          timestamp: new Date(),
        };
        addMessage(errorMessage);
      } finally {
        setIsLoading(false);
        clearPendingAuditData();
      }
    };

    processAuditData();
  }, [pendingAuditData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check for speech recognition support
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true; // Enable interim results for real-time transcript
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Update transcript display in real-time
          if (isVoiceModeRef.current) {
            setCurrentTranscript(finalTranscript || interimTranscript);
          }

          // Only process final results
          if (finalTranscript) {
            setIsListening(false);
            setCurrentTranscript(finalTranscript);
            // Mark that this input came from voice
            isVoiceInputRef.current = true;
            // If in voice mode, immediately send without showing in input field
            if (isVoiceModeRef.current) {
              // Immediately process voice input without waiting
              handleSendFromVoice(finalTranscript);
            } else {
              // If not in voice mode, just set the input
              setInput(finalTranscript);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error === "no-speech" && isVoiceModeRef.current) {
            // If no speech detected in voice mode, restart listening
            setTimeout(() => {
              if (recognitionRef.current && !isLoadingRef.current) {
                try {
                  recognitionRef.current?.start();
                } catch (e) {
                  // Ignore errors
                }
              }
            }, 500);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          // In voice mode, automatically restart listening after a short delay (only if not loading)
          if (isVoiceModeRef.current && !isLoadingRef.current) {
            setTimeout(() => {
              if (recognitionRef.current && isVoiceModeRef.current && !isLoadingRef.current) {
                try {
                  recognitionRef.current?.start();
                } catch (e) {
                  // Ignore errors if already started
                }
              }
            }, 800);
          }
        };

        recognitionRef.current = recognition;
      }

      // Initialize speech synthesis
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Check MCP connection when switching to audit-finance agent
  const handleAgentChange = async (agent: "ask" | "audit-finance") => {
    setSelectedAgent(agent);

    if (agent === "audit-finance") {
      setAgentStatus("connecting");
      try {
        const res = await fetch("/api/modules/chatbot/audit-health");
        const data = await res.json();
        if (data.connected) {
          setAgentStatus("connected");
        } else {
          setAgentStatus("failed");
        }
      } catch {
        setAgentStatus("failed");
      }
    } else {
      setAgentStatus("idle");
    }
  };

  if (!isOpen) return null;

  const speakText = (text: string, onEnd?: () => void) => {
    if (!isVoiceEnabled || !synthRef.current) {
      if (onEnd) onEnd();
      return;
    }

    // Remove markdown and chart placeholders for speech
    const cleanText = text
      .replace(/<chart>.*?<\/chart>/gs, "")
      .replace(/__CHART_PLACEHOLDER_\d+__/g, "")
      .replace(/[#*_`\[\]()]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (cleanText) {
      synthRef.current.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (onEnd) {
        utterance.onend = onEnd;
      }
      
      synthRef.current.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isLoadingRef.current) {
      try {
        setIsVoiceMode(true); // Enter voice conversation mode
        isVoiceModeRef.current = true;
        setIsVoiceEnabled(true); // Auto-enable voice output in voice mode
        setCurrentTranscript(""); // Clear previous transcript
        // Start listening immediately
        recognitionRef.current?.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsVoiceMode(false); // Exit voice conversation mode
    isVoiceModeRef.current = false;
    setIsListening(false);
    setCurrentTranscript(""); // Clear transcript
    // Cancel any ongoing speech
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  const switchToTextMode = () => {
    stopListening();
  };

  const handleSendFromVoice = async (transcript: string) => {
    if (!transcript.trim() || isLoadingRef.current) return;

    // Clear transcript display
    setCurrentTranscript("");

    // Immediately add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: transcript,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);
    isLoadingRef.current = true;

    try {
      // If in audit mode, capture screenshot + DOM scrape (fallback)
      let auditPayload: Record<string, any> = {};
      if (selectedAgent === "audit-finance") {
        const [screenshot, pageData] = await Promise.all([
          capturePageScreenshot(),
          Promise.resolve(scrapeCurrentPage()),
        ]);
        if (screenshot) auditPayload.screenshot = screenshot;
        auditPayload.pageData = pageData;
      }

      const response = await fetch("/api/modules/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: transcript,
          agent: selectedAgent,
          currentPage: pathname,
          ...auditPayload,
          context: {
            transactions,
            summary,
            categories,
          },
        }),
      });

      const data = await response.json();
      if (data.conversationId) conversationIdRef.current = data.conversationId;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      addMessage(assistantMessage);
      
      // Immediately speak the response without waiting
      speakText(data.response, () => {
        // After speaking finishes, restart listening in voice mode
        if (isVoiceModeRef.current && recognitionRef.current) {
          isLoadingRef.current = false;
          setIsLoading(false);
          setTimeout(() => {
            try {
              if (isVoiceModeRef.current && !isLoadingRef.current && recognitionRef.current) {
                recognitionRef.current.start();
              }
            } catch (e) {
              // Ignore errors
            }
          }, 300);
        } else {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
      speakText(errorMessage.content, () => {
        isLoadingRef.current = false;
        setIsLoading(false);
        if (isVoiceModeRef.current && recognitionRef.current) {
          setTimeout(() => {
            try {
              if (isVoiceModeRef.current && !isLoadingRef.current && recognitionRef.current) {
                recognitionRef.current.start();
              }
            } catch (e) {
              // Ignore errors
            }
          }, 300);
        }
      });
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !operationPrefix) || isLoading) return;

    // Combine operation prefix with input if prefix exists
    const fullMessage = operationPrefix ? `${operationPrefix} ${input.trim()}` : input.trim();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: fullMessage,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    const messageToSend = fullMessage;
    setInput("");
    setOperationPrefix("");
    setIsLoading(true);

    try {
      // If in audit mode, capture screenshot + DOM scrape (fallback)
      let auditPayload: Record<string, any> = {};
      if (selectedAgent === "audit-finance") {
        const [screenshot, pageData] = await Promise.all([
          capturePageScreenshot(),
          Promise.resolve(scrapeCurrentPage()),
        ]);
        if (screenshot) auditPayload.screenshot = screenshot;
        auditPayload.pageData = pageData;
      }

      const response = await fetch("/api/modules/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: messageToSend,
          agent: selectedAgent,
          currentPage: pathname,
          ...auditPayload,
          context: {
            transactions,
            summary,
            categories,
          },
        }),
      });

      const data = await response.json();
      if (data.conversationId) conversationIdRef.current = data.conversationId;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      addMessage(assistantMessage);
      
      // Speak the response if voice is enabled
      // In voice mode, automatically restart listening after speaking
      if (isVoiceEnabled || isVoiceMode) {
        if (isVoiceMode) {
          speakText(data.response, () => {
            // After speaking finishes, restart listening
            if (recognitionRef.current && !isLoadingRef.current) {
              setTimeout(() => {
                try {
                  recognitionRef.current?.start();
                } catch (e) {
                  // Ignore errors
                }
              }, 500);
            }
          });
        } else {
          speakText(data.response);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
      if (isVoiceEnabled || isVoiceMode) {
        if (isVoiceMode) {
          speakText(errorMessage.content, () => {
            if (recognitionRef.current && !isLoadingRef.current) {
              setTimeout(() => {
                try {
                  recognitionRef.current?.start();
                } catch (e) {
                  // Ignore errors
                }
              }, 500);
            }
          });
        } else {
          speakText(errorMessage.content);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="dialog fixed bottom-[104px] right-4 z-50 w-80 md:bottom-7 md:right-7">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-[15px] font-semibold">Ask Ledger AI</h3>
          <div className="flex gap-2">
            <button
              onClick={expandChatbot}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeChatbot}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog fixed bottom-[104px] right-4 z-50 flex h-[min(600px,70vh)] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden md:bottom-7 md:right-7">
      {/* Voice Mode Overlay - shows within popup */}
      {isVoiceMode && (
        <div className="absolute inset-0 z-50 flex flex-col rounded-dialog bg-gradient-to-br from-accent-900 via-accent-700 to-accent">
          <VoiceModeView
            isListening={isListening}
            transcript={currentTranscript}
            onClose={stopListening}
            onSwitchToText={switchToTextMode}
            userName="User"
          />
        </div>
      )}
      
      {/* Regular chat interface - hidden when in voice mode */}
      {!isVoiceMode && (
        <>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold">Ask Ledger AI</h3>
          <div className="flex gap-1.5">
            <button
              onClick={minimizeChatbot}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
              title="Full Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeChatbot}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selectedAgent}
            onChange={(e) => handleAgentChange(e.target.value as "ask" | "audit-finance")}
            disabled={isLoading || agentStatus === "connecting"}
            className={`flex-1 px-2.5 py-1.5 text-xs font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${
              selectedAgent === "audit-finance"
                ? agentStatus === "connected"
                  ? "bg-gain-bg border-gain text-gain"
                  : agentStatus === "failed"
                    ? "bg-loss-bg border-loss text-loss"
                    : "bg-warn-bg border-warn text-warn"
                : "bg-panel border-divider text-neutral-800"
            } disabled:opacity-50`}
          >
            <option value="ask">Ask (Default)</option>
            <option value="audit-finance">Audit Finance</option>
          </select>
          {selectedAgent === "audit-finance" && (
            <span className="flex-shrink-0">
              {agentStatus === "connecting" && (
                <span className="inline-block w-3 h-3 border-2 border-warn border-t-transparent rounded-full animate-spin" />
              )}
              {agentStatus === "connected" && (
                <span className="inline-block w-3 h-3 bg-gain rounded-full" title="MCP Connected" />
              )}
              {agentStatus === "failed" && (
                <span className="inline-block w-3 h-3 bg-loss rounded-full" title="MCP Connection Failed" />
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-8">
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
              className={`max-w-[80%] rounded-[18px] px-3.5 py-2.5 ${
                message.role === "user"
                  ? "bg-accent text-white"
                  : "bg-tile text-ink"
              }`}
            >
              {message.role === "assistant" ? (
                <div>
                  {(() => {
                    // Safety check: ensure message.content is a string
                    if (!message.content || typeof message.content !== 'string') {
                      return (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm max-w-none"
                        >
                          {message.content || ''}
                        </ReactMarkdown>
                      );
                    }

                    // Parse chart data from <chart> tags
                    const chartRegex = /<chart>(.*?)<\/chart>/gs;
                    const charts: any[] = [];
                    let processedContent = message.content || '';
                    let match;
                    let chartIndex = 0;

                    // First, try to find <chart> tags
                    while ((match = chartRegex.exec(message.content)) !== null) {
                      try {
                        const chartData = JSON.parse(match[1]);
                        if (chartData.type && chartData.data && Array.isArray(chartData.data)) {
                          charts.push(chartData);
                          // Replace chart tag with placeholder
                          processedContent = processedContent.replace(
                            match[0],
                            `__CHART_PLACEHOLDER_${chartIndex}__`
                          );
                          chartIndex++;
                        }
                      } catch (e) {
                        console.error("Error parsing chart data:", e);
                      }
                    }

                    // If no <chart> tags found, try to find JSON objects that look like chart data
                    if (charts.length === 0) {
                      // Look for JSON objects with type, title, and data fields
                      const jsonChartRegex = /\{[\s\S]*?"type"\s*:\s*"(pie|bar|line)"[\s\S]*?"data"\s*:\s*\[[\s\S]*?\]/g;
                      let jsonMatch;
                      while ((jsonMatch = jsonChartRegex.exec(message.content)) !== null) {
                        try {
                          // Try to extract the complete JSON object (handle nested objects)
                          let braceCount = 0;
                          let jsonStart = jsonMatch.index;
                          let jsonEnd = jsonStart;
                          
                          for (let i = jsonStart; i < message.content.length; i++) {
                            if (message.content[i] === '{') braceCount++;
                            if (message.content[i] === '}') braceCount--;
                            if (braceCount === 0) {
                              jsonEnd = i + 1;
                              break;
                            }
                          }
                          
                          if (jsonEnd > jsonStart) {
                            const jsonStr = message.content.substring(jsonStart, jsonEnd);
                            const chartData = JSON.parse(jsonStr);
                            if (chartData.type && chartData.data && Array.isArray(chartData.data) && chartData.data.length > 0) {
                              console.log("✅ Found chart data in JSON format:", chartData);
                              charts.push(chartData);
                              processedContent = processedContent.replace(
                                jsonStr,
                                `__CHART_PLACEHOLDER_${chartIndex}__`
                              );
                              chartIndex++;
                            }
                          }
                        } catch (e) {
                          console.error("Error parsing JSON chart:", e);
                        }
                      }
                    }
                    
                    if (charts.length > 0) {
                      console.log(`✅ Rendered ${charts.length} chart(s) in chatbot response`);
                    }

                    // Split content by chart placeholders (ensure processedContent is a string)
                    const parts = (processedContent || '').split(/(__CHART_PLACEHOLDER_\d+__)/);
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
            <div className="bg-tile rounded-[18px] px-3.5 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-neutral-500 rounded-full [animation:lgDot_1.2s_infinite]" />
                <div className="w-2 h-2 bg-neutral-500 rounded-full [animation:lgDot_1.2s_.2s_infinite]" />
                <div className="w-2 h-2 bg-neutral-500 rounded-full [animation:lgDot_1.2s_.4s_infinite]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        {/* Operation Tags */}
        <div className="mb-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setOperationPrefix("+ Create");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary btn-sm"
            >
              + Create
            </button>
            <button
              onClick={() => {
                setOperationPrefix("✏️ Update");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary btn-sm"
            >
              ✏️ Update
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me my portfolio summary");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary btn-sm"
            >
              📊 Summary
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me a chart of my investments");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary btn-sm"
            >
              📈 Chart
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            {operationPrefix && (
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                <span className="tag tag-accent font-semibold">
                  {operationPrefix}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOperationPrefix("");
                    }}
                    className="hover:bg-accent-200 rounded p-0.5 transition-colors"
                    title="Remove operation"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
                <span className="w-px h-3 bg-neutral-300"></span>
                <span className="w-0.5 h-3 bg-accent animate-pulse"></span>
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                  setOperationPrefix("");
                }
              }}
              placeholder={operationPrefix ? "Enter details..." : selectedAgent === "audit-finance" ? "Ask to audit your data or paste a calculator URL..." : "Ask about your finances or click mic to speak..."}
              className={`input ${operationPrefix ? '!pl-36' : ''}`}
              disabled={isLoading || isListening}
            />
          </div>
          <button
            onClick={isListening || isVoiceMode ? stopListening : startListening}
            disabled={isLoading}
            className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white transition-colors ${
              isListening || isVoiceMode
                ? "bg-loss animate-pulse"
                : "bg-[var(--logo-bg)] hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening || isVoiceMode ? "Stop Talk Mode" : "Start Talk Mode - Speak naturally"}
          >
            {isListening || isVoiceMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="btn btn-primary"
          >
            Send
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

