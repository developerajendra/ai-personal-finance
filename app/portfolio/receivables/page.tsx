import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { ReceivablesSummary } from "@/modules/portfolio/components/ReceivablesSummary";

export default function ReceivablesPage() {
  return (
    <AppShell>
      <PageHeader crumbs={[{ label: "Portfolio", href: "/portfolio" }, { label: "Receivables" }]} title="Receivables" meta="Track money owed to you" />
      <ReceivablesSummary />
      <PortfolioGrid lockedTab="receivables" />
    </AppShell>
  );
}
