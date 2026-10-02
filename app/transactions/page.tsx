import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { CashFlowTabs } from "@/shared/components/SectionTabs";
import { DataGrid } from "@/modules/admin-panel/components/DataGrid";

export default function TransactionsPage() {
  return (
    <AppShell>
      <PageHeader crumbs={[{ label: "Cash flow", href: "/transactions" }, { label: "Transactions" }]} title="Cash flow" />
      <CashFlowTabs />
      <DataGrid />
    </AppShell>
  );
}
