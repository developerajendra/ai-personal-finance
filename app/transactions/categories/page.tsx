import { Sidebar } from "@/shared/components/Sidebar";
import { DynamicCategoriesView } from "@/modules/admin-panel/components/DynamicCategoriesView";

export default function CategoriesPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Transaction Categories</h1>
            <p className="text-gray-600 mt-1">
              View AI-generated categories and learned patterns from your financial data
            </p>
          </div>

          <DynamicCategoriesView />
        </div>
      </main>
    </div>
  );
}

