import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { LoansTabs } from "@/shared/components/SectionTabs";
import { LoanHero } from "@/modules/portfolio/components/LoanHero";
import { LoansDetailView } from "@/modules/portfolio/components/LoansDetailView";
import { LoanAnalyticsModule } from "@/modules/portfolio/components/LoanAnalyticsModule";

export default function LoansPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: "Loans & receivables", href: "/portfolio/loans" }, { label: "Loans" }]}
        title="Loans"
        meta={false}
      />
      <LoansTabs />
      <LoanHero />
      <LoanAnalyticsModule />
      <div className="mt-6">
        <LoansDetailView />
      </div>
    </AppShell>
  );
}
