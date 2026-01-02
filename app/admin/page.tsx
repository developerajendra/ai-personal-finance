import { AdminPanelModule } from "@/modules/admin-panel/components/AdminPanelModule";
import { Sidebar } from "@/shared/components/Sidebar";

export default function AdminPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AdminPanelModule />
      </main>
    </div>
  );
}

