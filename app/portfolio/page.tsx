'use client';

import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { PortfolioExplorer } from "@/modules/portfolio/components/PortfolioExplorer";
import { BalanceSheetPanel, RetirementPanel } from "@/modules/portfolio/components/BalanceSheetPanel";
import { usePortfolioTotals } from "@/shared/hooks/usePortfolioTotals";
import { useMoney } from "@/shared/hooks/useMoney";

export default function PortfolioPage() {
  const t = usePortfolioTotals();
  const { M, S } = useMoney();

  return (
    <AppShell>
      <PageHeader
        crumbs={[]}
        title="Portfolio overview"
        meta={<>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "")} · market values at last synced prices · other balances as of their own dates</>}
        hero={{
          value: M(t.assets),
          metas: [
            { label: "Holdings", value: t.holdings },
            { label: "Unrealised on market", value: `${t.unrealised >= 0 ? "▲" : "▼"} ${S(t.unrealised)}`, tone: t.unrealised >= 0 ? "gain" : "loss" },
            { label: "Liabilities", value: M(t.liabilities) },
            { label: "Net worth", value: M(t.netWorth) },
          ],
        }}
      />

      <PortfolioExplorer />

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <BalanceSheetPanel classes={t.classes} assets={t.assets} liabilities={t.liabilities} netWorth={t.netWorth} />
        {t.byKey.pf.value > 0 && <RetirementPanel ppfAccounts={t.ppfAccounts} records={t.retirementInvestments} total={t.byKey.pf.value} />}
      </div>
    </AppShell>
  );
}
