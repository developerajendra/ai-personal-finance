import { Sidebar } from "@/shared/components/Sidebar";
import { DataGrid } from "@/modules/admin-panel/components/DataGrid";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function TransactionsPage() {
  return (
    <GmailLoginGate>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-gray-600 mt-1">
                View and manage all your financial transactions
              </p>
            </div>

            <DataGrid />
          </div>
        </main>
      </div>
    </GmailLoginGate>
  );
}

