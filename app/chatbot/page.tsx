import { ChatbotPage } from "@/modules/chatbot/components/ChatbotPage";
import { Sidebar } from "@/shared/components/Sidebar";

export default function ChatbotFullPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <ChatbotPage />
      </main>
    </div>
  );
}

