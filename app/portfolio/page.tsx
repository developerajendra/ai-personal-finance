'use client';

import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { ClassCards } from "@/modules/portfolio/components/ClassCards";
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
        meta={<>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "")} · market prices cached</>}
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

      <ClassCards classes={t.classes} />

      <div className="mt-6">
        <PortfolioGrid />
      </div>
    </AppShell>
  );
}
