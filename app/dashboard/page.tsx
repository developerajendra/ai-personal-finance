import { DashboardModule } from "@/modules/dashboard/components/DashboardModule";
import { Sidebar } from "@/shared/components/Sidebar";

export default function DashboardPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DashboardModule />
      </main>
    </div>
  );
}

