"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/shared/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatChart } from "./ChatChart";
import { AudioLines, MessageCircle, MicOff, X } from "lucide-react";
import { LinkButton, PageHeader } from "@/shared/components/ui";
import { VoiceModeView } from "./VoiceModeView";

export function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Server-side conversation id so follow-up answers (e.g. a missing amount)
  // resolve against the same thread; reset when the chat is cleared.
  const conversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) conversationIdRef.current = null;
  }, [messages.length]);
  const [input, setInput] = useState("");
  const [operationPrefix, setOperationPrefix] = useState<string>(""); // Track selected operation
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

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

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
      const response = await fetch("/api/modules/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: transcript,
        }),
      });

      const data = await response.json();
      if (data.conversationId) conversationIdRef.current = data.conversationId;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || (data.error ? `The assistant isn't available right now: ${data.error}` : "Sorry, I didn't get a reply. Please try again."),
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
      const response = await fetch("/api/modules/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: messageToSend,
        }),
      });

      const data = await response.json();
      if (data.conversationId) conversationIdRef.current = data.conversationId;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || (data.error ? `The assistant isn't available right now: ${data.error}` : "Sorry, I didn't get a reply. Please try again."),
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

  // Show voice mode view when in voice mode
  if (isVoiceMode) {
    return (
      <VoiceModeView
        isListening={isListening}
        transcript={currentTranscript}
        onClose={stopListening}
        onSwitchToText={switchToTextMode}
        userName="User"
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] max-w-[860px] flex-col">
      <PageHeader title="Assistant" meta={false} />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[14px] text-muted">Answers about your finances only — portfolio, loans, budget, subscriptions and more.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/settings#whatsapp" variant="secondary" icon={MessageCircle}>
              WhatsApp
            </LinkButton>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 py-6">
        {messages.length === 0 && (
          <div className="mt-10 max-w-[720px]">
            <h2 className="text-[26px] text-ink">Ask about your money.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Try “What’s my total net worth?”, “Show me my loans and outstanding amounts” or “Analyze my spending by category”. Changes to records are always shown for review first.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`msg-in flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] text-[15px] leading-relaxed ${
                message.role === "user"
                  ? "rounded-[16px] bg-accent-100 px-4 py-3 text-ink"
                  : "panel px-4 py-3.5 text-ink"
              }`}
            >
              <div className="eyebrow mb-1.5">{message.role === "user" ? "You" : "Assistant"}</div>
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
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="panel msg-in px-4 py-3.5" aria-label="Assistant is typing">
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

      <div className="sticky bottom-24 pb-2 pt-4 md:bottom-0" style={{ background: "linear-gradient(to bottom, transparent, var(--color-bg) 18px)" }}>
        {/* Operation Tags */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setOperationPrefix("+ Create Investment");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              + Create Investment
            </button>
            <button
              onClick={() => {
                setOperationPrefix("✏️ Update Investment");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              Update Investment
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me my portfolio summary");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              Portfolio Summary
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me a chart of my investments");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              Investment Chart
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("what are my total expenses this month?");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              Expenses
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me my loans");
              }}
              disabled={isLoading || isListening}
              className="btn btn-secondary"
            >
              Loans
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            {operationPrefix && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
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
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <span className="w-px h-4 bg-neutral-300"></span>
                <span className="w-0.5 h-4 bg-accent animate-pulse"></span>
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSend();
                  setOperationPrefix("");
                }
              }}
              placeholder={operationPrefix ? "Enter details..." : "Ask about your finances or click mic to speak..."}
              className={`input !min-h-[46px] ${operationPrefix ? '!pl-44' : ''}`}
              disabled={isLoading || isListening}
            />
          </div>
          <button
            onClick={isListening || isVoiceMode ? stopListening : startListening}
            disabled={isLoading}
            className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening || isVoiceMode ? "bg-loss animate-pulse" : "bg-[var(--logo-bg)] hover:opacity-90"
            }`}
            title={isListening || isVoiceMode ? "Stop Talk Mode" : "Start Talk Mode - Speak naturally"}
            aria-label={isListening || isVoiceMode ? "Stop talk mode" : "Start talk mode"}
          >
            {isListening || isVoiceMode ? <MicOff className="w-5 h-5" /> : <AudioLines className="w-5 h-5" />}
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="btn btn-primary btn-lg !min-h-[46px] !px-6"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

