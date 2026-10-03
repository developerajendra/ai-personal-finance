import { AppShell } from '@/shared/components/AppShell';
import { PageHeader, Panel } from '@/shared/components/ui';
import { GmailConnection } from '@/modules/admin-panel/components/GmailConnection';

export default function AdminPortfolioPage() {
  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: 'Data', href: '/data/upload' }, { label: 'Gmail import' }]}
        title="Portfolio management"
        meta="Login with Gmail to automatically create investments from emails"
      />
      <Panel className="max-w-[640px]">
        <GmailConnection />
      </Panel>
    </AppShell>
  );
}
