import { ArchiveModule } from "@/modules/dashboard/components/ArchiveModule";
import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";

export default function SnapshotsPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: "Trends & analysis", href: "/performance" }, { label: "Monthly snapshots" }]}
        title="Monthly snapshots"
        meta="Month-end values of every asset class · Trends & analysis is built from these"
      />
      <ArchiveModule />
    </AppShell>
  );
}
