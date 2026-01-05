import { Sidebar } from "@/shared/components/Sidebar";
import { BankBalancesDetailView } from "@/modules/portfolio/components/BankBalancesDetailView";

export default function BankBalancesPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Bank Balances</h1>
            <p className="text-gray-600 mt-1">
              View and analyze your bank account balances
            </p>
          </div>

          <BankBalancesDetailView />
        </div>
      </main>
    </div>
  );
}

