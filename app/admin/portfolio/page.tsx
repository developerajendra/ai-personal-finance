import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { AIAnalysisSummary } from "@/modules/admin-panel/components/AIAnalysisSummary";
import Link from "next/link";
import { TrendingUp, PieChart, ArrowRight } from "lucide-react";

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

          {/* Quick Links to Stocks and Mutual Funds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/portfolio/stocks"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Stocks</h3>
                    <p className="text-sm text-gray-600">View Zerodha stock holdings</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/admin/portfolio/mutual-funds"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <PieChart className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Mutual Funds</h3>
                    <p className="text-sm text-gray-600">View Zerodha mutual fund investments</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </Link>
          </div>

          <AIAnalysisSummary />

          <PortfolioGrid />
        </div>
      </main>
    </div>
  );
}

