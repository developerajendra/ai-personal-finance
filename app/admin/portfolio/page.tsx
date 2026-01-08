import { Sidebar } from '@/shared/components/Sidebar';
import { GmailConnection } from '@/modules/admin-panel/components/GmailConnection';

export default function AdminPortfolioPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Portfolio Management</h1>
            <p className="text-gray-600 mt-1">
              Login with Gmail to automatically create investments from emails
            </p>
          </div>

          <GmailConnection />
        </div>
      </div>
    </div>
  );
}
