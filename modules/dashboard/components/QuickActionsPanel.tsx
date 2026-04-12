"use client";

import Link from "next/link";
import {
  Plus,
  TrendingUp,
  CreditCard,
  Archive,
  Upload,
  BarChart2,
  Building2,
  Landmark,
} from "lucide-react";

interface Action {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const ACTIONS: Action[] = [
  {
    label: "Upload Expenses",
    href: "/data/upload",
    icon: <Upload className="w-4 h-4" />,
    description: "Import from Excel or PDF",
  },
  {
    label: "Add Investment",
    href: "/portfolio",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "FD, bonds, mutual funds",
  },
  {
    label: "Add Loan",
    href: "/portfolio/loans",
    icon: <CreditCard className="w-4 h-4" />,
    description: "Track loan & EMI",
  },
  {
    label: "Add Property",
    href: "/portfolio/properties",
    icon: <Building2 className="w-4 h-4" />,
    description: "Real estate assets",
  },
  {
    label: "Bank Balances",
    href: "/portfolio/bank-balances",
    icon: <Landmark className="w-4 h-4" />,
    description: "Update account balances",
  },
  {
    label: "View Archive",
    href: "/dashboard/archive",
    icon: <Archive className="w-4 h-4" />,
    description: "Historical snapshots",
  },
  {
    label: "AI Analysis",
    href: "/data/analysis",
    icon: <BarChart2 className="w-4 h-4" />,
    description: "Get AI-powered insights",
  },
];

export function QuickActionsPanel() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <Plus className="w-4 h-4 text-indigo-600" />
        <h3 className="text-base font-semibold text-gray-800">Quick Actions</h3>
      </div>

      <div className="space-y-1">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-colors group"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 group-hover:bg-indigo-100 text-gray-500 group-hover:text-indigo-600 transition-colors flex-shrink-0">
              {action.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 transition-colors">
                {action.label}
              </p>
              <p className="text-xs text-gray-400 truncate">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
