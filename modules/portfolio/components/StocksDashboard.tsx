"use client";

import { useQuery } from "@tanstack/react-query";
import { ZerodhaStock } from "@/core/services/zerodhaService";
import { Loader } from "@/shared/components/Loader";
import { TrendingUp, TrendingDown, RefreshCw, Link as LinkIcon, LogOut, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface StocksResponse {
  stocks: ZerodhaStock[];
  isAuthenticated: boolean;
  message?: string;
  error?: string;
}

export function StocksDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery<StocksResponse>({
    queryKey: ["zerodha-stocks"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/stocks");
      if (!response.ok) throw new Error("Failed to fetch stocks");
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const stocks = data?.stocks || [];
  const isAuthenticated = data?.isAuthenticated || false;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/zerodha/login");
      const { loginUrl } = await response.json();
      if (loginUrl) {
        window.location.href = loginUrl;
      }
    } catch (error) {
      console.error("Error connecting to Zerodha:", error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/zerodha/logout", { method: "POST" });
      router.refresh();
      refetch();
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const totalValue = stocks.reduce(
    (sum, stock) => sum + stock.last_price * stock.quantity,
    0
  );
  const totalPnl = stocks.reduce((sum, stock) => sum + stock.pnl, 0);
  const totalPnlPercentage =
    totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader text="Loading stocks data..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Not connected to Zerodha
              </p>
              <p className="text-xs text-yellow-600">
                {data?.message || "Connect your Zerodha account to view real-time data"}
              </p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            {isConnecting ? "Connecting..." : "Connect Zerodha"}
          </button>
        </div>
      )}

      {isAuthenticated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-medium text-green-800">
              Connected to Zerodha
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Holdings</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {stocks.length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total P&L</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  totalPnl >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{totalPnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
              <p
                className={`text-sm mt-1 ${
                  totalPnlPercentage >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalPnlPercentage >= 0 ? "+" : ""}
                {totalPnlPercentage.toFixed(2)}%
              </p>
            </div>
            {totalPnl >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stock Holdings</h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exchange</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P&L</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P&L %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No stocks found. Connect your Zerodha account to view holdings.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const currentValue = stock.last_price * stock.quantity;
                  return (
                    <tr key={stock.instrument_token} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">
                        {stock.tradingsymbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{stock.exchange}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stock.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{stock.average_price.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{stock.last_price.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{currentValue.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap ${
                          stock.pnl >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {stock.pnl >= 0 ? "+" : ""}
                        ₹{stock.pnl.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap ${
                          stock.pnl_percentage >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {stock.pnl_percentage >= 0 ? "+" : ""}
                        {stock.pnl_percentage.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

