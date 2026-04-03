import { ArchiveModule } from "@/modules/dashboard/components/ArchiveModule";
import { Sidebar } from "@/shared/components/Sidebar";

export default function ArchivePage() {
  return (
    <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <ArchiveModule />
        </main>
    </div>
  );
}
