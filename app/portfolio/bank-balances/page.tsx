import { AppShell } from "@/shared/components/AppShell";
import { BankBalancesDetailView } from "@/modules/portfolio/components/BankBalancesDetailView";

export default function Page() {
  return (
    <AppShell>
      <BankBalancesDetailView />
    </AppShell>
  );
}
