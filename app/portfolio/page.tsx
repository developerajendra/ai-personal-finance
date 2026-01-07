import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { AIAnalysisSummary } from "@/modules/admin-panel/components/AIAnalysisSummary";
import { GmailConnection } from "@/modules/admin-panel/components/GmailConnection";
import { EmailInvestmentsView } from "@/modules/admin-panel/components/EmailInvestmentsView";
import Link from "next/link";
import { TrendingUp, PieChart, ArrowRight, CreditCard, Home, Wallet } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Portfolio Overview</h1>
            <p className="text-gray-600 mt-1">
              Manage your investments, loans, properties, and bank balances
            </p>
          </div>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/portfolio/investments"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Investments</h3>
                    <p className="text-sm text-gray-600">FD, PPF, Mutual Funds</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/portfolio/stocks"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-green-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Stocks</h3>
                    <p className="text-sm text-gray-600">Zerodha holdings</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/portfolio/mutual-funds"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <PieChart className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Mutual Funds</h3>
                    <p className="text-sm text-gray-600">Zerodha investments</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/portfolio/loans"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-red-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <CreditCard className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Loans</h3>
                    <p className="text-sm text-gray-600">Manage loans</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/portfolio/properties"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-orange-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <Home className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Properties</h3>
                    <p className="text-sm text-gray-600">Real estate assets</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
              </div>
            </Link>

            <Link
              href="/portfolio/bank-balances"
              className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <Wallet className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Bank Balances</h3>
                    <p className="text-sm text-gray-600">Account balances</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
              </div>
            </Link>
          </div>

          <AIAnalysisSummary />

          {/* Gmail Integration Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Email Integration</h2>
              <p className="text-gray-600 text-sm mt-1">
                Connect Gmail to automatically create investments from emails
              </p>
            </div>
            <GmailConnection />
            <EmailInvestmentsView />
          </div>

          <PortfolioGrid />
        </div>
      </main>
    </div>
  );
}

