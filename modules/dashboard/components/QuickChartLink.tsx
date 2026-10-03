"use client";

import { BarChart3 } from "lucide-react";

interface QuickChartLinkProps {
  onClick: () => void;
}

export function QuickChartLink({ onClick }: QuickChartLinkProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent-700 transition-colors rounded-pill font-medium"
    >
      <BarChart3 className="w-5 h-5" />
      <span>Quick Chart</span>
    </button>
  );
}

