"use client";

import { useQuery } from "@tanstack/react-query";
import { Investment, Loan, Property } from "@/core/types";
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
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <Loader text="Loading AI analysis summary..." />
      </div>
    );
  }

  if (aiGeneratedItems.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">AI Analysis Ready</h3>
            <p className="text-sm text-blue-700 mt-1">
              Upload an Excel file to automatically extract and categorize your financial data.
              The AI will identify investments, loans, and properties from your Excel sheet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle className="w-3 h-3 text-green-600" />
        <h2 className="text-base font-semibold">AI Analysis Results</h2>
        <span className="text-xs text-gray-500">
          ({aiGeneratedItems.length})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mb-1.5">
        <div className="bg-green-50 rounded-lg p-1.5 border border-green-200">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <h3 className="text-xs font-semibold text-green-900">Investments</h3>
          </div>
          <p className="text-lg font-bold text-green-700">
            {investments.length}
          </p>
          <p className="text-xs text-green-600">
            ₹{totalInvestments.toLocaleString()}
          </p>
        </div>

        <div className="bg-red-50 rounded-lg p-1.5 border border-red-200">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-600" />
            <h3 className="text-xs font-semibold text-red-900">Loans</h3>
          </div>
          <p className="text-lg font-bold text-red-700">{loans.length}</p>
          <p className="text-xs text-red-600">
            ₹{totalLoans.toLocaleString()}
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-1.5 border border-blue-200">
          <div className="flex items-center gap-1">
            <Home className="w-3 h-3 text-blue-600" />
            <h3 className="text-xs font-semibold text-blue-900">Properties</h3>
          </div>
          <p className="text-lg font-bold text-blue-700">{properties.length}</p>
          <p className="text-xs text-blue-600">
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
                    className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs"
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
                    className="px-1 py-0.5 bg-red-100 text-red-800 rounded text-xs"
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
                    className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
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

