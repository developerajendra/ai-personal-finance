"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ZerodhaStock } from "@/shared/types";
import { Loader } from "@/shared/components/Loader";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMoney } from "@/shared/hooks/useMoney";
import { HoldingsPanel } from "./HoldingsPanel";

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
  const queryClient = useQueryClient();
  const { O, S } = useMoney();

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
    try {
      // Fetch with refresh=true to sync from API
      const response = await fetch("/api/zerodha/stocks?refresh=true");
      if (!response.ok) throw new Error("Failed to refresh stocks");
      // Invalidate and refetch to update the cache
      await queryClient.invalidateQueries({ queryKey: ["zerodha-stocks"] });
      await refetch();
    } catch (error) {
      console.error("Error refreshing stocks:", error);
    } finally {
      setIsRefreshing(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader text="Loading stocks data..." size="lg" />
      </div>
    );
  }

  const pnlTone = (v: number) => (v >= 0 ? "text-gain" : "text-loss");

  return (
    <HoldingsPanel<ZerodhaStock>
      title="Stocks"
      isAuthenticated={isAuthenticated}
      message={data?.message}
      isConnecting={isConnecting}
      isRefreshing={isRefreshing}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onRefresh={handleRefresh}
      rows={stocks}
      rowKey={(s) => `${s.instrument_token}-${s.tradingsymbol}`}
      empty="No stocks found. Connect your Zerodha account to view holdings."
      columns={[
        { key: "symbol", label: "Symbol", render: (s) => <span className="font-semibold">{s.tradingsymbol}</span>, sortValue: (s) => s.tradingsymbol },
        { key: "exchange", label: "Exchange", render: (s) => <span className="text-muted">{s.exchange}</span> },
        { key: "qty", label: "Quantity", align: "right", render: (s) => s.quantity, sortValue: (s) => s.quantity },
        { key: "avg", label: "Avg price", align: "right", render: (s) => O(s.average_price), sortValue: (s) => s.average_price },
        { key: "ltp", label: "Last price", align: "right", render: (s) => O(s.last_price), sortValue: (s) => s.last_price },
        { key: "value", label: "Current value", align: "right", render: (s) => <span className="font-semibold">{O(s.last_price * s.quantity)}</span>, sortValue: (s) => s.last_price * s.quantity },
        { key: "pnl", label: "P&L", align: "right", render: (s) => <span className={pnlTone(s.pnl)}>{S(s.pnl, { dec: 2 })}</span>, sortValue: (s) => s.pnl },
        { key: "pnlp", label: "P&L %", align: "right", render: (s) => <span className={pnlTone(s.pnl_percentage)}>{s.pnl_percentage >= 0 ? "+" : "−"}{Math.abs(s.pnl_percentage).toFixed(2)}%</span>, sortValue: (s) => s.pnl_percentage },
      ]}
      detail={(s) => ({
        title: s.tradingsymbol,
        subtitle: `${s.exchange} · Zerodha holding`,
        rows: [
          ["Quantity", s.quantity],
          ["Average price", O(s.average_price)],
          ["Last price", O(s.last_price)],
          ["Invested", O(s.average_price * s.quantity)],
          ["Current value", O(s.last_price * s.quantity)],
          ["P&L", <span key="p" className={pnlTone(s.pnl)}>{S(s.pnl, { dec: 2 })} ({s.pnl_percentage.toFixed(2)}%)</span>],
        ],
      })}
    />
  );
}
