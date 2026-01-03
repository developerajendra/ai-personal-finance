"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Settings, MessageSquare, ChevronDown, ChevronRight, Upload, Database, Briefcase, Tag } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const adminSubmenu = [
  { name: "Upload & AI Analysis", href: "/admin/upload", icon: Upload },
  { name: "Transactions", href: "/admin/transactions", icon: Database },
  { name: "Portfolio (AI Categorized)", href: "/admin/portfolio", icon: Briefcase },
  { name: "Dynamic Categories", href: "/admin/categories", icon: Tag },
];

export function Sidebar() {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith("/admin");
  const [isAdminOpen, setIsAdminOpen] = useState(isAdminPath);

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">Finance AI</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        
        {/* Admin Accordion */}
        <div>
          <button
            onClick={() => setIsAdminOpen(!isAdminOpen)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors",
              isAdminPath
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5" />
              <span>Admin</span>
            </div>
            {isAdminOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {isAdminOpen && (
            <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-700 pl-2">
              {adminSubmenu.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/chatbot"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span>AI Assistant</span>
        </Link>
      </div>
    </div>
  );
}

