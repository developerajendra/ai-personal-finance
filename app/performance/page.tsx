import { AppShell } from "@/shared/components/AppShell";
import { PerformanceModule } from "@/modules/performance/components/PerformanceModule";
import { isRangeKey } from "@/shared/utils/netWorthHistory";

export default function PerformancePage({ searchParams }: { searchParams: { range?: string } }) {
  // ?range= comes from the dashboard Net worth card so the period carries over
  const range = isRangeKey(searchParams.range) ? searchParams.range : undefined;
  return (
    <AppShell>
      <PerformanceModule range={range} />
    </AppShell>
  );
}
