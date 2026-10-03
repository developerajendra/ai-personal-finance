import { ArchiveModule } from "@/modules/dashboard/components/ArchiveModule";
import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { CashFlowTabs } from "@/shared/components/SectionTabs";

export default function ArchivePage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: "Cash flow", href: "/transactions" }, { label: "Monthly snapshots" }]}
        title="Cash flow"
        meta="Month-end snapshots of every asset class"
      />
      <CashFlowTabs />
      <ArchiveModule />
    </AppShell>
  );
}
