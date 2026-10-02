import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { ImportsTabs } from "@/shared/components/SectionTabs";
import { AIAnalysisSummary } from "@/modules/admin-panel/components/AIAnalysisSummary";

export default function AnalysisPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: 'Data', href: '/data/upload' }, { label: 'AI analysis' }]}
        title="Imports & connections"
        meta="AI-generated insights from your imported files"
      />
      <ImportsTabs />
      <AIAnalysisSummary />
    </AppShell>
  );
}
