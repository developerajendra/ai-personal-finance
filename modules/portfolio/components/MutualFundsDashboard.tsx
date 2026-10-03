"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ZerodhaMutualFund } from "@/shared/types";
import { Loader } from "@/shared/components/Loader";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMoney } from "@/shared/hooks/useMoney";
import { HoldingsPanel } from "./HoldingsPanel";

interface MutualFundsResponse {
  mutualFunds: ZerodhaMutualFund[];
  isAuthenticated: boolean;
  message?: string;
  error?: string;
}

export function MutualFundsDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { O, S } = useMoney();

  const { data, isLoading, refetch } = useQuery<MutualFundsResponse>({
    queryKey: ["zerodha-mutual-funds"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/mutual-funds");
      if (!response.ok) throw new Error("Failed to fetch mutual funds");
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const mutualFunds = data?.mutualFunds || [];
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
      const response = await fetch("/api/zerodha/mutual-funds?refresh=true");
      if (!response.ok) throw new Error("Failed to refresh mutual funds");
      // Invalidate and refetch to update the cache
      await queryClient.invalidateQueries({ queryKey: ["zerodha-mutual-funds"] });
      await refetch();
    } catch (error) {
      console.error("Error refreshing mutual funds:", error);
    } finally {
      setIsRefreshing(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader text="Loading mutual funds data..." size="lg" />
      </div>
    );
  }

  const pnlTone = (v: number) => (v >= 0 ? "text-gain" : "text-loss");

  return (
    <HoldingsPanel<ZerodhaMutualFund>
      title="Mutual funds"
      isAuthenticated={isAuthenticated}
      message={data?.message}
      isConnecting={isConnecting}
      isRefreshing={isRefreshing}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onRefresh={handleRefresh}
      rows={mutualFunds}
      rowKey={(mf) => mf.folio + mf.tradingsymbol}
      empty="No mutual funds found. Connect your Zerodha account to view holdings."
      columns={[
        { key: "name", label: "Fund", render: (mf) => <span className="font-semibold">{mf.fund_name}</span>, sortValue: (mf) => mf.fund_name },
        { key: "folio", label: "Folio", render: (mf) => <span className="font-mono text-[13px] text-muted">{mf.folio}</span> },
        { key: "units", label: "Units", align: "right", render: (mf) => mf.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 }), sortValue: (mf) => mf.quantity },
        { key: "avg", label: "Avg NAV", align: "right", render: (mf) => O(mf.average_price), sortValue: (mf) => mf.average_price },
        { key: "nav", label: "NAV", align: "right", render: (mf) => O(mf.last_price), sortValue: (mf) => mf.last_price },
        { key: "value", label: "Current value", align: "right", render: (mf) => <span className="font-semibold">{O(mf.last_price * mf.quantity)}</span>, sortValue: (mf) => mf.last_price * mf.quantity },
        { key: "pnl", label: "P&L", align: "right", render: (mf) => <span className={pnlTone(mf.pnl)}>{S(mf.pnl, { dec: 2 })}</span>, sortValue: (mf) => mf.pnl },
        { key: "pnlp", label: "P&L %", align: "right", render: (mf) => <span className={pnlTone(mf.pnl_percentage)}>{mf.pnl_percentage >= 0 ? "+" : "−"}{Math.abs(mf.pnl_percentage).toFixed(2)}%</span>, sortValue: (mf) => mf.pnl_percentage },
      ]}
      detail={(mf) => ({
        title: mf.fund_name,
        subtitle: `${mf.tradingsymbol} · Folio ${mf.folio}`,
        rows: [
          ["Units", mf.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 })],
          ["Average NAV", O(mf.average_price)],
          ["Current NAV", O(mf.last_price)],
          ["Invested", O(mf.average_price * mf.quantity)],
          ["Current value", O(mf.last_price * mf.quantity)],
          ["P&L", <span key="p" className={pnlTone(mf.pnl)}>{S(mf.pnl, { dec: 2 })} ({mf.pnl_percentage.toFixed(2)}%)</span>],
        ],
      })}
    />
  );
}
