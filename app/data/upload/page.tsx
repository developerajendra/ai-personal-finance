import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { ImportsTabs } from "@/shared/components/SectionTabs";
import { FileUploadSection } from "@/modules/admin-panel/components/FileUploadSection";
import { ConnectionsPanel } from "@/modules/admin-panel/components/ConnectionsPanel";

export default function UploadPage() {
  return (
    <AppShell>
      <PageHeader crumbs={[{ label: "Data", href: "/data/upload" }, { label: "Imports & connections" }]} title="Imports & connections" />
      <ImportsTabs />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] lg:gap-14">
        <FileUploadSection />
        <ConnectionsPanel />
      </div>
    </AppShell>
  );
}
