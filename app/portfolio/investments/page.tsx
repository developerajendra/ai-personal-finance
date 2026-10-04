import { AppShell } from "@/shared/components/AppShell";
import { OtherInvestmentsView } from "@/modules/portfolio/components/InvestmentClassViews";

export default function InvestmentsPage() {
  return (
    <AppShell>
      <OtherInvestmentsView />
    </AppShell>
  );
}
