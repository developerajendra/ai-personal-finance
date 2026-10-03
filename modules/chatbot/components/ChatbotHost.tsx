"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useChatbot } from "../hooks/useChatbot";

// The chat popup pulls in markdown, charts and screenshot tooling. Load it only once
// the user first opens the assistant, instead of on every page load.
const ChatbotBoard = dynamic(() => import("./ChatbotBoard").then((m) => m.ChatbotBoard), { ssr: false });

export function ChatbotHost() {
  const { isOpen } = useChatbot();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (isOpen) setLoaded(true);
  }, [isOpen]);
  return loaded ? <ChatbotBoard /> : null;
}
