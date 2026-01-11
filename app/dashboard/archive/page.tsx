import { ArchiveModule } from "@/modules/dashboard/components/ArchiveModule";
import { Sidebar } from "@/shared/components/Sidebar";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function ArchivePage() {
  return (
    <GmailLoginGate>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <ArchiveModule />
        </main>
      </div>
    </GmailLoginGate>
  );
}
