import { AppShell } from "@/shared/components/AppShell";
import { ClassHeader } from "@/modules/portfolio/components/ClassPages";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";

export default function InvestmentsPage() {
  return (
    <AppShell>
      <ClassHeader classKey="investments" />
      <PortfolioGrid defaultTab="investment" />
    </AppShell>
  );
}
