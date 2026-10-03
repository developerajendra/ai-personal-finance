import { AppShell } from "@/shared/components/AppShell";
import { PageHeader } from "@/shared/components/ui";
import { CashFlowTabs } from "@/shared/components/SectionTabs";
import { DynamicCategoriesView } from "@/modules/admin-panel/components/DynamicCategoriesView";

export default function CategoriesPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: 'Cash flow', href: '/transactions' }, { label: 'Categories' }]}
        title="Cash flow"
        meta="AI-generated categories and learned patterns"
      />
      <CashFlowTabs />
      <DynamicCategoriesView />
    </AppShell>
  );
}
