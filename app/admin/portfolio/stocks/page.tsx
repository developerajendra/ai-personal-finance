import { Sidebar } from "@/shared/components/Sidebar";
import { StocksDashboard } from "@/modules/portfolio/components/StocksDashboard";

export default function StocksPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Stocks Portfolio</h1>
            <p className="text-gray-600 mt-1">
              View and manage your stock holdings from Zerodha
            </p>
          </div>

          <StocksDashboard />
        </div>
      </main>
    </div>
  );
}

