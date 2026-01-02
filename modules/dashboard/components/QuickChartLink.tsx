"use client";

import { BarChart3 } from "lucide-react";

interface QuickChartLinkProps {
  onClick: () => void;
}

export function QuickChartLink({ onClick }: QuickChartLinkProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <BarChart3 className="w-5 h-5" />
      <span>Quick Chart</span>
    </button>
  );
}

