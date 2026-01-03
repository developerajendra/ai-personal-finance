"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/core/types";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatChart } from "./ChatChart";
import { Mic, MicOff, X } from "lucide-react";
import { VoiceModeView } from "./VoiceModeView";

export function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [operationPrefix, setOperationPrefix] = useState<string>(""); // Track selected operation
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
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
          message: transcript,
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
          message: messageToSend,
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
    <div className="h-full flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">AI Financial Assistant</h1>
        <p className="text-gray-600 mt-1">
          Ask questions about your financial data and get AI-powered insights
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-16">
            <h2 className="text-xl font-semibold mb-2">
              Welcome to your Financial AI Assistant
            </h2>
            <p className="mb-4">
              I can help you understand your finances, analyze spending patterns,
              and provide insights.
            </p>
            <div className="mt-8 space-y-2 text-left max-w-md mx-auto">
              <p className="font-semibold">Try asking:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>"Give me a financial summary"</li>
                <li>"What are my total investments?"</li>
                <li>"Show me my loans and outstanding amounts"</li>
                <li>"What's my total net worth?"</li>
                <li>"Analyze my spending by category"</li>
                <li>"What are my bank balances?"</li>
              </ul>
            </div>
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
              className={`max-w-3xl rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
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
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
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

      <div className="p-6 border-t bg-gray-50">
        {/* Operation Tags */}
        <div className="max-w-4xl mx-auto mb-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setOperationPrefix("+ Create Investment");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Create Investment
            </button>
            <button
              onClick={() => {
                setOperationPrefix("✏️ Update Investment");
                setInput("");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✏️ Update Investment
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me my portfolio summary");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📊 Portfolio Summary
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me a chart of my investments");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📈 Investment Chart
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("what are my total expenses this month?");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💰 Expenses
            </button>
            <button
              onClick={() => {
                setOperationPrefix("");
                setInput("show me my loans");
              }}
              disabled={isLoading || isListening}
              className="px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💳 Loans
            </button>
          </div>
        </div>
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            {operationPrefix && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-md border border-blue-200 flex items-center gap-1.5">
                  {operationPrefix}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOperationPrefix("");
                    }}
                    className="hover:bg-blue-200 rounded p-0.5 transition-colors"
                    title="Remove operation"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <span className="w-px h-4 bg-gray-300"></span>
                <span className="w-0.5 h-4 bg-blue-600 animate-pulse"></span>
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
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${operationPrefix ? 'pl-32' : ''}`}
              disabled={isLoading || isListening}
            />
          </div>
          <button
            onClick={isListening || isVoiceMode ? stopListening : startListening}
            disabled={isLoading}
            className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
              isListening || isVoiceMode
                ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                : "bg-purple-600 text-white hover:bg-purple-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening || isVoiceMode ? "Stop Talk Mode" : "Start Talk Mode - Speak naturally"}
          >
            {isListening || isVoiceMode ? (
              <>
                <MicOff className="w-5 h-5 inline mr-2" />
                Talk Mode
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 inline mr-2" />
                Talk Mode
              </>
            )}
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

