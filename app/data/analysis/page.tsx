import { Sidebar } from "@/shared/components/Sidebar";
import { AIAnalysisSummary } from "@/modules/admin-panel/components/AIAnalysisSummary";

export default function AnalysisPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">AI Analysis</h1>
            <p className="text-gray-600 mt-1">
              View AI-generated insights and analysis of your financial data
            </p>
          </div>

          <AIAnalysisSummary />
        </div>
      </main>
    </div>
  );
}

