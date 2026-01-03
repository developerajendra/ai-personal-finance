import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { AIAnalysisSummary } from "@/modules/admin-panel/components/AIAnalysisSummary";

export default function AdminPortfolioPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Portfolio (AI Categorized)</h1>
            <p className="text-gray-600 mt-1">
              Manage your investments, loans, properties, and bank balances categorized by AI
            </p>
          </div>

          <AIAnalysisSummary />

          <PortfolioGrid />
        </div>
      </main>
    </div>
  );
}

