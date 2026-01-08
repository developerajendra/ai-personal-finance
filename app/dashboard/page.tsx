import { DashboardModule } from "@/modules/dashboard/components/DashboardModule";
import { Sidebar } from "@/shared/components/Sidebar";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function DashboardPage() {
  return (
    <GmailLoginGate>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <DashboardModule />
        </main>
      </div>
    </GmailLoginGate>
  );
}

