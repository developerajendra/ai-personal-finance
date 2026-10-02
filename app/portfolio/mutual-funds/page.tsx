import { AppShell } from "@/shared/components/AppShell";
import { StocksFundsView } from "@/modules/portfolio/components/ClassPages";

export default function Page() {
  return (
    <AppShell>
      <StocksFundsView initial="Funds" />
    </AppShell>
  );
}
