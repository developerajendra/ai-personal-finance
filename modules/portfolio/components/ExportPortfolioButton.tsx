"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportPortfolioButton() {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/portfolio");
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Export failed" }));
        throw new Error(err.error ?? "Export failed");
      }
      const blob = await response.blob();
      const today = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-export-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("[ExportPortfolioButton]", err);
      alert(err.message ?? "Failed to export portfolio. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2 transition-colors"
      aria-label="Export portfolio to Excel"
    >
      {isExporting
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Download className="w-4 h-4" />}
      {isExporting ? "Exporting..." : "Export Portfolio"}
    </button>
  );
}
