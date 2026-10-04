import { AppShell } from "@/shared/components/AppShell";
import { BudgetModule } from "@/modules/budget/components/BudgetModule";

export default function BudgetPage() {
  return (
    <AppShell>
      <BudgetModule />
    </AppShell>
  );
}
