import { Sidebar } from "@/shared/components/Sidebar";
import { PropertiesDetailView } from "@/modules/portfolio/components/PropertiesDetailView";

export default function PropertiesPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Properties</h1>
            <p className="text-gray-600 mt-1">
              View and analyze your real estate assets
            </p>
          </div>

          <PropertiesDetailView />
        </div>
      </main>
    </div>
  );
}

