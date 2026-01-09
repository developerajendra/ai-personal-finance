import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function ReceivablesPage() {
  return (
    <GmailLoginGate>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Receivables</h1>
              <p className="text-gray-600 mt-1">
                Track money owed to you
              </p>
            </div>

            <PortfolioGrid defaultTab="receivables" />
          </div>
        </main>
      </div>
    </GmailLoginGate>
  );
}
