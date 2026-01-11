import { LoanAnalyticsModule } from "@/modules/portfolio/components/LoanAnalyticsModule";
import { Sidebar } from "@/shared/components/Sidebar";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function LoanAnalyticsPage() {
  return (
    <GmailLoginGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <LoanAnalyticsModule />
        </main>
      </div>
    </GmailLoginGate>
  );
}
