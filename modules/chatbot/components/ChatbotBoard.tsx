"use client";

import { useState, useRef, useEffect } from "react";
import { useChatbot } from "../hooks/useChatbot";
import { X, Minimize2, Maximize2, MicOff, AudioLines, ArrowUp, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { ChatMessage } from "@/shared/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatChart } from "./ChatChart";
import { VoiceModeView } from "./VoiceModeView";

/** In full screen, keep messages and the input in a readable ~760px column. */
const WIDE_GUTTER = "px-[max(1rem,calc((100%-760px)/2))]";

export function ChatbotBoard() {
  const { isOpen, closeChatbot, messages, addMessage } = useChatbot();
  // Server-side conversation id so follow-up answers (e.g. a missing amount)
  // resolve against the same thread; reset when the chat is cleared.
  const conversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) conversationIdRef.current = null;
  }, [messages.length]);
  const { data: session } = useSession();
  const firstName = (session?.user?.name || session?.user?.email || "").split(/[\s@]/)[0] || "there";
  // Play the close animation before unmounting the popup
  const [closing, setClosing] = useState(false);
  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      closeChatbot();
    }, 170);
  };
  // Suggestion tiles fill the input and send it on the next render
  const [queued, setQueued] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [operationPrefix, setOperationPrefix] = useState<string>(""); // Track selected operation
  // Full screen keeps the same conversation; the toggle in the header switches back
  const [fullScreen, setFullScreen] = useState(false);
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

  useEffect(() => {
    if (queued !== null && input === queued) {
      setQueued(null);
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, input]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  return (
    <>
    {fullScreen && <div aria-hidden className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={() => setFullScreen(false)} />}
    <div
      role="dialog"
      aria-label="Ledger AI assistant"
      aria-modal={fullScreen || undefined}
      className={`dialog fixed z-50 flex flex-col overflow-hidden ${
        fullScreen
          ? "inset-0 !rounded-none md:inset-6 md:!rounded-dialog"
          : "bottom-[172px] right-4 h-[min(620px,calc(100vh-200px))] w-[min(400px,calc(100vw-32px))] md:bottom-[100px] md:right-7"
      } ${closing ? "chat-out" : "chat-in"}`}
    >
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
      <div className="border-b border-divider px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent text-white">
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 leading-tight">
              <h3 className="text-[15px] font-semibold">Ledger AI</h3>
              <p className="truncate text-[12.5px] text-muted">Answers about your finances only</p>
            </div>
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={() => setFullScreen((f) => !f)}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
              title={fullScreen ? "Exit full screen" : "Full screen"}
              aria-label={fullScreen ? "Exit full screen" : "Full screen"}
              aria-pressed={fullScreen}
            >
              {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClose}
              className="rounded-full p-1.5 text-muted hover:bg-tile hover:text-ink"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 space-y-3 overflow-y-auto py-4 ${fullScreen ? WIDE_GUTTER : "px-4"}`}>
        {messages.length === 0 && (
          <div className="msg-in pt-2">
            <h4 className="font-heading text-[20px] font-bold leading-snug tracking-[-0.01em]">Hi {firstName}, what would you like to know?</h4>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Ask in chat, talk in voice mode, or continue on WhatsApp. Record changes are always shown for review first.
            </p>
            <div className="mt-4 space-y-2">
              {[
                ["Portfolio summary", "show me my portfolio summary"],
                ["What's my net worth?", "What's my total net worth?"],
                ["Show my loans", "show me my loans and outstanding amounts"],
                ["Who owes me?", "Who owes me money?"],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  onClick={() => {
                    setOperationPrefix("");
                    setInput(prompt!);
                    setQueued(prompt!);
                  }}
                  disabled={isLoading}
                  className="block w-full rounded-[12px] bg-tile px-4 py-3 text-left text-[14px] transition-colors hover:bg-accent-100 hover:text-accent-800 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
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

      <div className={`pb-3 pt-2 ${fullScreen ? WIDE_GUTTER : "px-3"}`}>
        {/* Operation Tags */}
        <div className={messages.length === 0 ? "hidden" : "mb-2"}>
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
              placeholder={operationPrefix ? "Enter details..." : "Ask about your finances or click mic to speak..."}
              className={`input !min-h-[44px] !rounded-full !border-transparent !bg-tile !pr-12 !pl-4 ${operationPrefix ? '!pl-36' : ''}`}
              aria-label="Ask anything"
              disabled={isLoading || isListening}
            />
          <button
            onClick={isListening || isVoiceMode ? stopListening : startListening}
            disabled={isLoading}
            aria-label={isListening || isVoiceMode ? "Stop talk mode" : "Start talk mode"}
            className={`absolute right-[4px] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white transition-colors ${
              isListening || isVoiceMode
                ? "bg-loss animate-pulse"
                : "bg-[var(--logo-bg)] hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening || isVoiceMode ? "Stop Talk Mode" : "Start Talk Mode - Speak naturally"}
          >
            {isListening || isVoiceMode ? <MicOff className="w-4 h-4" /> : <AudioLines className="w-4 h-4" />}
          </button>
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`btn btn-primary btn-icon !h-11 !w-11 transition-all ${input.trim() ? "" : "hidden"}`}
            aria-label="Send"
          >
            <ArrowUp className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
        </>
      )}
    </div>
    </>
  );
}

