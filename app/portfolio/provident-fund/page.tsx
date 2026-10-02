import { AppShell } from "@/shared/components/AppShell";
import { ClassHeader } from "@/modules/portfolio/components/ClassPages";
import { ProvidentFundDetailView } from "@/modules/portfolio/components/ProvidentFundDetailView";

export default function Page() {
  return (
    <AppShell>
      <ClassHeader classKey="pf" />
      <ProvidentFundDetailView />
    </AppShell>
  );
}
