"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useChatbot } from "../hooks/useChatbot";

export function ChatbotIcon() {
  const { openChatbot, closeChatbot, isOpen } = useChatbot();
  const pathname = usePathname() || "";
  const [hint, setHint] = useState(true);
  const [hover, setHover] = useState(false);

  // The "Ask Ledger AI" hint shows briefly on load, then only on hover
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (pathname.startsWith("/chatbot") || pathname.startsWith("/auth")) return null;

  return (
    <div className="fixed bottom-[104px] right-4 z-50 flex items-center gap-3 md:bottom-7 md:right-7">
      {(hint || hover) && !isOpen && (
        <div className="pointer-events-none hidden rounded-[12px] bg-[#1d1d1f] px-3 py-2 text-white shadow-lg sm:block" role="tooltip">
          <div className="text-[13px] font-semibold">Ask Ledger AI</div>
          <div className="text-[12px] opacity-75">Chat, voice or WhatsApp</div>
        </div>
      )}
      <button
        onClick={isOpen ? closeChatbot : openChatbot}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105"
        style={{ boxShadow: "0 8px 24px color-mix(in srgb, var(--color-accent) 45%, transparent)" }}
        title={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        aria-expanded={isOpen}
      >
        <span className="relative grid h-6 w-6 place-items-center">
          <Sparkles className={`absolute h-6 w-6 transition-all duration-200 ${isOpen ? "rotate-90 scale-50 opacity-0" : "opacity-100"}`} strokeWidth={1.75} />
          <X className={`absolute h-6 w-6 transition-all duration-200 ${isOpen ? "opacity-100" : "-rotate-90 scale-50 opacity-0"}`} strokeWidth={1.75} />
        </span>
      </button>
    </div>
  );
}
