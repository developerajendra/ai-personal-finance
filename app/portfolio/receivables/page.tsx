import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { LoansTabs } from "@/shared/components/SectionTabs";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { ReceivablesSummary } from "@/modules/portfolio/components/ReceivablesSummary";

export default function ReceivablesPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: "Loans & receivables", href: "/portfolio/loans" }, { label: "Receivables" }]}
        title="Receivables"
        meta="Track money owed to you"
      />
      <LoansTabs />
      <ReceivablesSummary />
      <PortfolioGrid defaultTab="receivables" />
    </AppShell>
  );
}
