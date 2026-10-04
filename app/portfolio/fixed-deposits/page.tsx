import { AppShell } from "@/shared/components/AppShell";
import { FixedDepositsView } from "@/modules/portfolio/components/InvestmentClassViews";

export default function FixedDepositsPage() {
  return (
    <AppShell>
      <FixedDepositsView />
    </AppShell>
  );
}
