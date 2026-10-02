import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { CashFlowTabs } from "@/shared/components/SectionTabs";
import { SubscriptionsModule } from "@/modules/cashflow/components/SubscriptionsModule";

export default function SubscriptionsPage() {
  return (
    <AppShell>
      <PageHeader crumbs={[{ label: "Cash flow", href: "/transactions" }, { label: "Subscriptions" }]} title="Subscriptions" />
      <CashFlowTabs />
      <SubscriptionsModule />
    </AppShell>
  );
}
