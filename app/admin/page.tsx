import { Sidebar } from "@/shared/components/Sidebar";
import Link from "next/link";
import { Upload, Database, Briefcase, Tag, ArrowRight } from "lucide-react";

export default function AdminPage() {
  const adminSections = [
    {
      name: "Upload & AI Analysis",
      href: "/admin/upload",
      icon: Upload,
      description: "Upload Excel files and let AI automatically extract, categorize, and organize your financial data",
    },
    {
      name: "Transactions",
      href: "/admin/transactions",
      icon: Database,
      description: "View and manage all your financial transactions",
    },
    {
      name: "Portfolio (AI Categorized)",
      href: "/admin/portfolio",
      icon: Briefcase,
      description: "Manage your investments, loans, properties, and bank balances categorized by AI",
    },
    {
      name: "Dynamic Categories",
      href: "/admin/categories",
      icon: Tag,
      description: "View AI-generated categories and learned patterns from your financial data",
    },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-600 mt-1">
              Manage your financial data, upload files, and view AI-generated insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adminSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {section.name}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {section.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

