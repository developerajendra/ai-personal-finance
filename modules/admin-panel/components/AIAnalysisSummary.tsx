"use client";

import { useQuery } from "@tanstack/react-query";
import { Investment, Loan, Property } from "@/shared/types";
import { TrendingUp, TrendingDown, Home, CheckCircle, AlertCircle } from "lucide-react";
import { Loader } from "@/shared/components/Loader";

export function AIAnalysisSummary() {
  const { data: investments = [], isLoading: isLoadingInvestments } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/investments");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: loans = [], isLoading: isLoadingLoans } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/loans");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: properties = [], isLoading: isLoadingProperties } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/properties");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const isLoading = isLoadingInvestments || isLoadingLoans || isLoadingProperties;

  const aiGeneratedItems = [
    ...investments.filter((inv) => inv.id.startsWith("inv-ai-")),
    ...loans.filter((loan) => loan.id.startsWith("loan-ai-")),
    ...properties.filter((prop) => prop.id.startsWith("prop-ai-")),
  ];

  const totalInvestments = investments
    .filter((inv) => inv.status !== 'closed')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalLoans = loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalProperties = properties.reduce(
    (sum, prop) => sum + (prop.currentValue || prop.purchasePrice),
    0
  );

  if (isLoading) {
    return (
      <div className="panel p-4">
        <Loader text="Loading AI analysis summary..." />
      </div>
    );
  }

  if (aiGeneratedItems.length === 0) {
    return (
      <div className="bg-accent-100 border border-accent-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent-700 mt-0.5" />
          <div>
            <h3 className="font-semibold text-accent-800">AI Analysis Ready</h3>
            <p className="text-sm text-accent-700 mt-1">
              Upload an Excel file to automatically extract and categorize your financial data.
              The AI will identify investments, loans, and properties from your Excel sheet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle className="w-3 h-3 text-gain" />
        <h2 className="text-base font-semibold">AI Analysis Results</h2>
        <span className="text-xs text-muted">
          ({aiGeneratedItems.length})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mb-1.5">
        <div className="bg-gain-bg rounded-lg p-1.5 border border-divider">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-gain" />
            <h3 className="text-xs font-semibold text-gain">Investments</h3>
          </div>
          <p className="text-lg font-bold text-gain">
            {investments.length}
          </p>
          <p className="text-xs text-gain">
            ₹{totalInvestments.toLocaleString()}
          </p>
        </div>

        <div className="bg-loss-bg rounded-lg p-1.5 border border-divider">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-loss" />
            <h3 className="text-xs font-semibold text-loss">Loans</h3>
          </div>
          <p className="text-lg font-bold text-loss">{loans.length}</p>
          <p className="text-xs text-loss">
            ₹{totalLoans.toLocaleString()}
          </p>
        </div>

        <div className="bg-accent-100 rounded-lg p-1.5 border border-accent-200">
          <div className="flex items-center gap-1">
            <Home className="w-3 h-3 text-accent-700" />
            <h3 className="text-xs font-semibold text-accent-800">Properties</h3>
          </div>
          <p className="text-lg font-bold text-accent-700">{properties.length}</p>
          <p className="text-xs text-accent-700">
            ₹{totalProperties.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="border-t pt-1">
        <h3 className="text-xs font-semibold mb-0.5">Categorization Breakdown</h3>
        <div className="flex flex-wrap gap-0.5">
          {investments.length > 0 &&
            Array.from(new Set(investments.map((inv) => inv.type))).map(
              (type) => {
                const count = investments.filter((inv) => inv.type === type)
                  .length;
                return (
                  <span
                    key={`investment-${type}`}
                    className="px-1 py-0.5 bg-gain-bg text-gain rounded text-xs"
                  >
                    {type} ({count})
                  </span>
                );
              }
            )}

          {loans.length > 0 &&
            Array.from(new Set(loans.map((loan) => loan.type))).map(
              (type) => {
                const count = loans.filter((loan) => loan.type === type)
                  .length;
                return (
                  <span
                    key={`loan-${type}`}
                    className="px-1 py-0.5 bg-loss-bg text-loss rounded text-xs"
                  >
                    {type} ({count})
                  </span>
                );
              }
            )}

          {properties.length > 0 &&
            Array.from(new Set(properties.map((prop) => prop.type))).map(
              (type) => {
                const count = properties.filter(
                  (prop) => prop.type === type
                ).length;
                return (
                  <span
                    key={`property-${type}`}
                    className="px-1 py-0.5 bg-accent-100 text-accent-800 rounded text-xs"
                  >
                    {type} ({count})
                  </span>
                );
              }
            )}
        </div>
      </div>
    </div>
  );
}

