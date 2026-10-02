import { AppShell } from "@/shared/components/AppShell";
import { ClassHeader } from "@/modules/portfolio/components/ClassPages";
import { BankBalancesDetailView } from "@/modules/portfolio/components/BankBalancesDetailView";

export default function Page() {
  return (
    <AppShell>
      <ClassHeader classKey="bank" />
      <BankBalancesDetailView />
    </AppShell>
  );
}
