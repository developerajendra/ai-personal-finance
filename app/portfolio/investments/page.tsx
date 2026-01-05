import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";

export default function InvestmentsPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Investments</h1>
            <p className="text-gray-600 mt-1">
              Manage your fixed deposits, PPF, and other investments
            </p>
          </div>

          <PortfolioGrid defaultTab="investment" />
        </div>
      </main>
    </div>
  );
}

