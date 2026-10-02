"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useChatbot } from "../hooks/useChatbot";

export function ChatbotIcon() {
  const { openChatbot, isOpen } = useChatbot();
  const pathname = usePathname() || "";
  const [hint, setHint] = useState(true);
  const [hover, setHover] = useState(false);

  // The "Ask Ledger AI" hint shows briefly on load, then only on hover
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (isOpen || pathname.startsWith("/chatbot") || pathname.startsWith("/auth")) return null;

  return (
    <div className="fixed bottom-[104px] right-4 z-50 flex items-center gap-3 md:bottom-7 md:right-7">
      {(hint || hover) && (
        <div className="pointer-events-none hidden rounded-[12px] bg-[#1d1d1f] px-3 py-2 text-white shadow-lg sm:block" role="tooltip">
          <div className="text-[13px] font-semibold">Ask Ledger AI</div>
          <div className="text-[12px] opacity-75">Chat, voice or WhatsApp</div>
        </div>
      )}
      <button
        onClick={openChatbot}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105"
        style={{ boxShadow: "0 8px 24px color-mix(in srgb, var(--color-accent) 45%, transparent)" }}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-6 w-6" strokeWidth={1.75} />
      </button>
    </div>
  );
}
