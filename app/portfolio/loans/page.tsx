import { Sidebar } from "@/shared/components/Sidebar";
import { LoansDetailView } from "@/modules/portfolio/components/LoansDetailView";

export default function LoansPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Loans</h1>
            <p className="text-gray-600 mt-1">
              View and analyze your loans and liabilities
            </p>
          </div>

          <LoansDetailView />
        </div>
      </main>
    </div>
  );
}

