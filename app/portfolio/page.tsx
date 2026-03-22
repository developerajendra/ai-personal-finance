'use client';

import { Sidebar } from "@/shared/components/Sidebar";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";
import Link from "next/link";
import { TrendingUp, PieChart, ArrowRight, CreditCard, Home, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Investment, Loan, Property, BankBalance } from "@/core/types";

export default function PortfolioPage() {

  // Fetch portfolio data
  const { data: investments = [] } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/investments");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: loans = [] } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/loans");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/properties");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: bankBalances = [] } = useQuery<BankBalance[]>({
    queryKey: ["bankBalances"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/bank-balances");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: stocksData } = useQuery<{ stocks: any[] }>({
    queryKey: ["stocks"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/stocks");
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });

  const { data: mutualFundsData } = useQuery<{ mutualFunds: any[] }>({
    queryKey: ["mutualFunds"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/mutual-funds");
      if (!response.ok) return { mutualFunds: [] };
      return response.json();
    },
  });

  // Calculate totals (exclude closed investments from net worth)
  const totalInvestments = investments
    .filter((inv) => inv.status !== 'closed')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalLoans = loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalProperties = properties.reduce((sum, prop) => sum + (prop.currentValue || prop.purchasePrice), 0);
  const totalBankBalances = bankBalances.reduce((sum, bb) => sum + (bb.balance || 0), 0);
  const totalStocks = stocksData?.stocks?.reduce((sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)), 0) || 0;
  const totalMutualFunds = mutualFundsData?.mutualFunds?.reduce((sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)), 0) || 0;

  return (
    <GmailLoginGate>
      <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Portfolio Overview</h1>
                <p className="text-gray-600 mt-1">
                  Manage your investments, loans, properties, and bank balances
                </p>
              </div>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-6 gap-2">
            <Link
              href="/portfolio/investments"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Investments</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalInvestments.toLocaleString()}</p>
                    <p className="text-xs text-blue-600 font-medium">{investments.filter((inv) => inv.status !== 'closed').length} items</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </div>
            </Link>

            <Link
              href="/portfolio/stocks"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-green-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Stocks</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalStocks.toLocaleString()}</p>
                    <p className="text-xs text-green-600 font-medium">{stocksData?.stocks?.length || 0} holdings</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0" />
              </div>
            </Link>

            <Link
              href="/portfolio/mutual-funds"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors flex-shrink-0">
                    <PieChart className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Mutual Funds</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalMutualFunds.toLocaleString()}</p>
                    <p className="text-xs text-purple-600 font-medium">{mutualFundsData?.mutualFunds?.length || 0} funds</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
              </div>
            </Link>

            <Link
              href="/portfolio/loans"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-red-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors flex-shrink-0">
                    <CreditCard className="w-3 h-3 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Loans</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalLoans.toLocaleString()}</p>
                    <p className="text-xs text-red-600 font-medium">{loans.length} loans</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
              </div>
            </Link>

            <Link
              href="/portfolio/properties"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-orange-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors flex-shrink-0">
                    <Home className="w-3 h-3 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalProperties.toLocaleString()}</p>
                    <p className="text-xs text-orange-600 font-medium">{properties.length} properties</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-orange-600 transition-colors flex-shrink-0" />
              </div>
            </Link>

            <Link
              href="/portfolio/bank-balances"
              className="bg-white rounded-lg shadow p-3 border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors flex-shrink-0">
                    <Wallet className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Bank Balances</h3>
                    <p className="text-xs text-gray-600 truncate">₹{totalBankBalances.toLocaleString()}</p>
                    <p className="text-xs text-indigo-600 font-medium">{bankBalances.length} accounts</p>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
              </div>
            </Link>
          </div>

          <PortfolioGrid />
        </div>
      </main>
      </div>
    </GmailLoginGate>
  );
}

