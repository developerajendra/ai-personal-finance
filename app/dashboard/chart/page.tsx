import { Sidebar } from "@/shared/components/Sidebar";
import { ChatbotPage } from "@/modules/chatbot/components/ChatbotPage";

export default function ChartPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <ChatbotPage />
      </main>
    </div>
  );
}

