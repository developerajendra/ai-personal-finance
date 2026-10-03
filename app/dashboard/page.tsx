import { DashboardModule } from "@/modules/dashboard/components/DashboardModule";
import { AppShell } from "@/shared/components/AppShell";

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardModule />
    </AppShell>
  );
}
