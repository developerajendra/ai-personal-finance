"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoanMonthlySnapshot, Loan } from "@/core/types";
import { formatIndianNumber } from "@/core/services/currencyService";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  CreditCard,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Settings,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { Loader } from "@/shared/components/Loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/Tabs";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function LoanAnalyticsModule() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [activeTab, setActiveTab] = useState<"analytics" | "settings">("analytics");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  // Fetch loans to get loan names
  const { data: loansData } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/loans");
      if (!response.ok) throw new Error("Failed to fetch loans");
      return response.json();
    },
  });

  // Fetch email metadata
  const { data: emailMetadataData } = useQuery<{ metadata: any[] }>({
    queryKey: ["loan-email-metadata"],
    queryFn: async () => {
      const response = await fetch("/api/loans/email-metadata");
      if (!response.ok) throw new Error("Failed to fetch email metadata");
      return response.json();
    },
  });

  // Fetch all snapshots (latest first)
  const { data: snapshotsData, isLoading, refetch: refetchSnapshots } = useQuery<{
    snapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }>;
  }>({
    queryKey: ["loan-analytics-snapshots"],
    queryFn: async () => {
      // Get all available years first
      const yearsResponse = await fetch("/api/loans/analytics?action=years");
      if (!yearsResponse.ok) {
        return { snapshots: [] };
      }
      const yearsData = await yearsResponse.json();
      const years = yearsData.years || [];

      // Fetch snapshots for all years
      const allSnapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }> = [];
      for (const year of years) {
        const response = await fetch(`/api/loans/analytics?year=${year}`);
        if (response.ok) {
          const data = await response.json();
          if (data.snapshots) {
            allSnapshots.push(...data.snapshots);
          }
        }
      }

      // Sort by year and month (latest first)
      allSnapshots.sort((a, b) => {
        if (a.snapshot.year !== b.snapshot.year) {
          return b.snapshot.year - a.snapshot.year;
        }
        return b.snapshot.month - a.snapshot.month;
      });

      return { snapshots: allSnapshots };
    },
  });

  const snapshots = snapshotsData?.snapshots || [];
  const loans = loansData || [];

  // Group snapshots by year and month (show latest first)
  const snapshotMap = new Map<string, Array<{ snapshot: LoanMonthlySnapshot; growth: any }>>();
  snapshots.forEach((item) => {
    const key = `${item.snapshot.year}-${item.snapshot.month}`;
    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, []);
    }
    snapshotMap.get(key)!.push(item);
  });

  // Get all snapshot keys sorted (latest first)
  const snapshotKeys = Array.from(snapshotMap.keys()).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });

  // Calculate year totals
  const yearTotals = snapshots.reduce(
    (acc, item) => {
      acc.totalOutstanding += item.snapshot.outstandingAmount;
      acc.totalPrincipalPaid += item.snapshot.principalPaid;
      acc.totalInterestPaid += item.snapshot.interestPaid;
      return acc;
    },
    {
      totalOutstanding: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
    }
  );

  const avgOutstanding = snapshots.length > 0 ? yearTotals.totalOutstanding / snapshots.length : 0;

  if (isLoading) {
    return (
      <div className="p-6">
        <div>
          <h1 className="text-3xl font-bold">Loan Analytics</h1>
          <p className="text-gray-600 mt-1">View historical loan data</p>
        </div>
        <div className="mt-8">
          <Loader text="Loading loan analytics..." size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Loan Analytics</h1>
        <p className="text-gray-600 mt-1">View historical loan data and trends</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "analytics" | "settings")}>
        <TabsList className="mt-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Email Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          {/* Fetch Latest Email Button */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Loan Analytics</h2>
            <p className="text-sm text-gray-600 mt-1">
              Automatically fetch and process loan-related emails (quarterly summaries and interest rate changes)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  setProcessStatus(null);
                  const response = await fetch("/api/loans/fetch-latest", {
                    method: "POST",
                  });
                  const data = await response.json();
                  
                  if (data.success) {
                    setProcessStatus({
                      success: true,
                      message: `Successfully processed latest quarterly summary from ${new Date(data.email.date).toLocaleDateString()}. Outstanding amount calculated using Disbursement Amount.`,
                    });
                    // Refetch snapshots and metadata after processing
                    setTimeout(() => {
                      refetchSnapshots();
                      queryClient.invalidateQueries({ queryKey: ["loan-email-metadata"] });
                    }, 2000);
                  } else {
                    setProcessStatus({
                      success: false,
                      message: data.error || "Failed to fetch latest loan summary",
                    });
                  }
                } catch (error: any) {
                  setProcessStatus({
                    success: false,
                    message: error.message || "Error fetching latest loan summary",
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader text="" size="sm" />
                  <span>Fetching Latest Email...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Fetch Latest Quarterly Summary</span>
                </>
              )}
            </button>
            <button
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  setProcessStatus(null);
                  const response = await fetch("/api/loans/fetch-rate-change", {
                    method: "POST",
                  });
                  const data = await response.json();
                  
                  if (data.success) {
                    setProcessStatus({
                      success: true,
                      message: data.message || `Successfully updated interest rate from ${data.extractedData.oldRate}% to ${data.extractedData.newRate}% (effective ${data.extractedData.effectiveDate}). Updated ${data.result.updatedSnapshots} snapshot(s).`,
                    });
                    // Refetch snapshots and metadata after processing
                    setTimeout(() => {
                      refetchSnapshots();
                      queryClient.invalidateQueries({ queryKey: ["loan-email-metadata"] });
                    }, 2000);
                  } else {
                    setProcessStatus({
                      success: false,
                      message: data.error || "Failed to fetch interest rate change email",
                    });
                  }
                } catch (error: any) {
                  setProcessStatus({
                    success: false,
                    message: error.message || "Error fetching interest rate change email",
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader text="" size="sm" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Percent className="w-5 h-5" />
                  <span>Fetch Interest Rate Change</span>
                </>
            )}
            </button>
          </div>
        </div>
            {processStatus && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              processStatus.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <p className="text-sm">{processStatus.message}</p>
          </div>
        )}
      </div>

      {/* Email Metadata Display */}
      {emailMetadataData?.metadata && emailMetadataData.metadata.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Data Source Information</h3>
          <div className="space-y-4">
            {emailMetadataData.metadata.map((meta: any) => {
              const firstEmailDate = new Date(meta.firstEmailDate);
              const lastEmailDate = new Date(meta.lastEmailDate);
              const allEmails = meta.emails || [];
              
              return (
                <div key={meta.loanId} className="text-sm text-blue-800">
                  <div className="mb-2">
                    <p className="font-medium">
                      📧 First Email: <span className="font-normal">{meta.firstEmailTitle}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Date: {firstEmailDate.toLocaleDateString()} | 
                      Starting Point: {firstEmailDate.toLocaleDateString()}
                    </p>
                  </div>
                  
                  {meta.lastEmailDate !== meta.firstEmailDate && (
                    <div className="mb-2">
                      <p className="font-medium">
                        📧 Latest Email: <span className="font-normal">{meta.lastEmailTitle}</span>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Date: {lastEmailDate.toLocaleDateString()} | 
                        Total Emails Processed: {meta.totalEmailsProcessed}
                      </p>
                    </div>
                  )}
                  
                  {allEmails.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 mb-2">All Processed Emails ({allEmails.length}):</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {allEmails.map((email: any, idx: number) => {
                          const emailDate = new Date(email.emailDate);
                          const isRateChange = email.emailTitle?.toLowerCase().includes('interest rate') || 
                                               email.emailTitle?.toLowerCase().includes('rate change');
                          return (
                            <div key={email.emailId || idx} className="text-xs bg-blue-100 rounded px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span className={isRateChange ? "text-orange-600" : "text-blue-600"}>
                                  {isRateChange ? "📊" : "📧"}
                                </span>
                                <span className="font-medium truncate flex-1">{email.emailTitle}</span>
                                <span className="text-blue-500 whitespace-nowrap">
                                  {emailDate.toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Header */}
      {snapshots.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Loan Analytics Summary</h2>
              <p className="text-purple-100 mt-1">
                {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-purple-200">Latest Outstanding</p>
                <p className="text-xl font-bold">
                  {formatIndianNumber(snapshots[0]?.snapshot.outstandingAmount || 0)}
                </p>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div className="text-right">
                <p className="text-xs text-purple-200">Total Principal Paid</p>
                <p className="text-xl font-bold">
                  {formatIndianNumber(yearTotals.totalPrincipalPaid)}
                </p>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div className="text-right">
                <p className="text-xs text-purple-200">Total Interest Paid</p>
                <p className="text-xl font-bold">
                  {formatIndianNumber(yearTotals.totalInterestPaid)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Grid */}
      {snapshotKeys.length === 0 ? (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 mb-4">
            No loan snapshots available. Click "Fetch Latest Quarterly Summary" to process the latest email.
          </p>
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-8 gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-purple-200 font-semibold text-xs text-gray-700">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Month</span>
            </div>
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-purple-600" />
              <span>Outstanding</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span>Principal Paid</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-red-600" />
              <span>Interest Paid till date</span>
            </div>
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-blue-600" />
              <span>EMI Amount</span>
            </div>
            <div className="flex items-center gap-1">
              <Percent className="w-3 h-3 text-yellow-600" />
              <span>Interest Rate</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600" />
              <span>Remaining Tenure</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-600" />
              <span>Last Updated</span>
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-200">
            {snapshotKeys.map((key) => {
              const [year, month] = key.split('-').map(Number);
              const monthSnapshots = snapshotMap.get(key) || [];
              return monthSnapshots.map((item, index) => {
                const { snapshot, growth } = item;
                const loan = loans.find((l) => l.id === snapshot.loanId);
                const loanName = loan?.name || "Unknown Loan";

                return (
                  <LoanMonthRow
                    key={`${snapshot.id}-${index}`}
                    month={month}
                    monthName={FULL_MONTHS[month - 1]}
                    year={year}
                    snapshot={snapshot}
                    growth={growth}
                    loanName={loanName}
                    isCurrentMonth={month === currentMonth && year === currentYear}
                  />
                );
              });
            })}
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="settings">
          <EmailPatternsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailPatternsSettings() {
  const [newPatternTitle, setNewPatternTitle] = useState("");
  const [newPatternType, setNewPatternType] = useState<"quarterly-summary" | "interest-rate-change" | "other">("quarterly-summary");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const queryClient = useQueryClient();

  // Fetch email patterns
  const { data: patternsData, isLoading } = useQuery<{ patterns: any[] }>({
    queryKey: ["loan-email-patterns"],
    queryFn: async () => {
      const response = await fetch("/api/loans/email-patterns");
      if (!response.ok) throw new Error("Failed to fetch patterns");
      return response.json();
    },
  });

  const patterns = patternsData?.patterns || [];

  const handleAddPattern = async () => {
    if (!newPatternTitle.trim()) {
      alert("Please enter an email title pattern");
      return;
    }

    try {
      const response = await fetch("/api/loans/email-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPatternTitle,
          type: newPatternType,
          enabled: true,
        }),
      });

      if (response.ok) {
        setNewPatternTitle("");
        queryClient.invalidateQueries({ queryKey: ["loan-email-patterns"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add pattern");
      }
    } catch (error: any) {
      alert("Error adding pattern: " + error.message);
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email pattern?")) {
      return;
    }

    try {
      const response = await fetch(`/api/loans/email-patterns?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["loan-email-patterns"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete pattern");
      }
    } catch (error: any) {
      alert("Error deleting pattern: " + error.message);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const response = await fetch("/api/loans/email-patterns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          enabled: !currentEnabled,
        }),
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["loan-email-patterns"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update pattern");
      }
    } catch (error: any) {
      alert("Error updating pattern: " + error.message);
    }
  };

  const handleStartEdit = (pattern: any) => {
    setEditingId(pattern.id);
    setEditTitle(pattern.title);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) {
      alert("Please enter an email title pattern");
      return;
    }

    try {
      const response = await fetch("/api/loans/email-patterns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: editTitle,
        }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditTitle("");
        queryClient.invalidateQueries({ queryKey: ["loan-email-patterns"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update pattern");
      }
    } catch (error: any) {
      alert("Error updating pattern: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  if (isLoading) {
    return (
      <div className="mt-6">
        <Loader text="Loading email patterns..." size="lg" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Email Title Patterns - Combined */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Title Patterns</h2>
        
        {/* Add New Pattern Form - Inline */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Pattern</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email Title Pattern
              </label>
              <input
                type="text"
                value={newPatternTitle}
                onChange={(e) => setNewPatternTitle(e.target.value)}
                placeholder="e.g., Quarterly Loan Summary Update"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPattern();
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Pattern Type
              </label>
              <select
                value={newPatternType}
                onChange={(e) => setNewPatternType(e.target.value as "quarterly-summary" | "interest-rate-change" | "other")}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="quarterly-summary">Quarterly Summary</option>
                <option value="interest-rate-change">Interest Rate Change</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddPattern}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Pattern</span>
              </button>
            </div>
          </div>
        </div>

        {/* Existing Patterns */}
        <div>
          {patterns.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No email patterns configured. Add one above.</p>
          ) : (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  {editingId === pattern.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(pattern.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(pattern.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{pattern.title}</p>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            pattern.type === "quarterly-summary"
                              ? "bg-blue-100 text-blue-700"
                              : pattern.type === "interest-rate-change"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {pattern.type === "quarterly-summary"
                            ? "Quarterly"
                            : pattern.type === "interest-rate-change"
                            ? "Rate Change"
                            : "Other"}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            pattern.enabled
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {pattern.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(pattern.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                {editingId !== pattern.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleEnabled(pattern.id, pattern.enabled)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        pattern.enabled
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {pattern.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleStartEdit(pattern)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      title="Edit pattern"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePattern(pattern.id)}
                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Delete pattern"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Loan Reference Data Section */}
      <LoanReferenceDataSettings />
    </div>
  );
}

function LoanReferenceDataSettings() {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  // Fetch global reference data
  const { data: referenceDataResponse } = useQuery<{ referenceData: any }>({
    queryKey: ["loan-reference-data"],
    queryFn: async () => {
      const response = await fetch("/api/loans/reference-data");
      if (!response.ok) throw new Error("Failed to fetch reference data");
      return response.json();
    },
  });

  const referenceData = referenceDataResponse?.referenceData;
  const dataEntries = referenceData?.data ? Object.entries(referenceData.data) : [];

  const handleAddKeyValue = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      alert("Please enter both key and value");
      return;
    }

    try {
      const numericValue = parseFloat(newValue.replace(/,/g, ''));
      const value = isNaN(numericValue) ? newValue : numericValue;

      const response = await fetch("/api/loans/reference-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim(),
          value,
        }),
      });

      if (response.ok) {
        setNewKey("");
        setNewValue("");
        queryClient.invalidateQueries({ queryKey: ["loan-reference-data"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add reference data");
      }
    } catch (error: any) {
      alert("Error adding reference data: " + error.message);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/loans/reference-data?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["loan-reference-data"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete reference data");
      }
    } catch (error: any) {
      alert("Error deleting reference data: " + error.message);
    }
  };

  const handleStartEdit = (key: string, value: string | number) => {
    setEditingKey(key);
    setEditValue(String(value));
  };

  const handleSaveEdit = async () => {
    if (!editingKey || !editValue.trim()) {
      alert("Please enter a value");
      return;
    }

    try {
      const numericValue = parseFloat(editValue.replace(/,/g, ''));
      const value = isNaN(numericValue) ? editValue : numericValue;

      const response = await fetch("/api/loans/reference-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingKey,
          value,
        }),
      });

      if (response.ok) {
        setEditingKey(null);
        setEditValue("");
        queryClient.invalidateQueries({ queryKey: ["loan-reference-data"] });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update reference data");
      }
    } catch (error: any) {
      alert("Error updating reference data: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan Reference Data</h2>
      <p className="text-sm text-gray-600 mb-4">
        Add loan details that are not in the email (e.g., Disbursement Amount). AI will analyze this data FIRST before processing emails and use it for calculations.
      </p>

      {/* Add New Key-Value */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Reference Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Key (e.g., Disbursement Amount)
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g., Disbursement Amount"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddKeyValue();
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g., 23,11,386"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddKeyValue();
                  }}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddKeyValue}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>
        </div>
      </div>

      {/* Existing Reference Data */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Existing Reference Data</h3>
            {dataEntries.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">
                No reference data configured. Add key-value pairs above.
              </p>
            ) : (
              <div className="space-y-2">
                {dataEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {editingKey === key ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-gray-700 min-w-[150px]">{key}:</span>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{key}:</span>
                          <span className="text-sm text-gray-700 ml-2">
                            {typeof value === 'number' ? formatIndianNumber(value) : value}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(key, value)}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Edit value"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key)}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
    </div>
  );
}

function LoanMonthRow({
  month,
  monthName,
  year,
  snapshot,
  growth,
  loanName,
  isCurrentMonth,
}: {
  month: number;
  monthName: string;
  year: number;
  snapshot: LoanMonthlySnapshot;
  growth: any;
  loanName: string;
  isCurrentMonth: boolean;
}) {
  const formatDifference = (value: number, isPercent: boolean = false) => {
    const isPositive = value >= 0;
    const absValue = Math.abs(value);
    return {
      value: absValue,
      isPositive,
      sign: isPositive ? "+" : "-",
      display: isPercent
        ? `${isPositive ? "+" : ""}${absValue.toFixed(2)}%`
        : `${isPositive ? "+" : ""}${formatIndianNumber(absValue)}`,
    };
  };

  const outstandingDiff = growth?.outstandingAmountChange
    ? formatDifference(growth.outstandingAmountChange)
    : null;
  const principalDiff = growth?.principalPaidChange
    ? formatDifference(growth.principalPaidChange)
    : null;
  const interestDiff = growth?.interestPaidChange
    ? formatDifference(growth.interestPaidChange)
    : null;
  const rateDiff = growth?.interestRateChange
    ? formatDifference(growth.interestRateChange)
    : null;
  const tenureDiff = growth?.tenureChange ? formatDifference(growth.tenureChange) : null;

  return (
    <div
      className={`grid grid-cols-8 gap-3 p-3 hover:bg-gray-50 transition-colors border-l-4 ${
        isCurrentMonth ? "bg-purple-50 border-purple-500" : "bg-white border-green-500"
      }`}
    >
      {/* Month Column */}
      <div className="flex items-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">{MONTHS[month - 1]} {year}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{monthName} {year}</p>
              <p className="text-xs text-gray-500 truncate">{loanName}</p>
              {isCurrentMonth && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  Latest
                </span>
              )}
            </div>
        </div>
      </div>

      {/* Outstanding Amount Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-purple-700">
            {formatIndianNumber(snapshot.outstandingAmount)}
          </p>
          {outstandingDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {outstandingDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-green-600" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  outstandingDiff.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {outstandingDiff.sign}
                {formatIndianNumber(outstandingDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Principal Paid Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-green-700">
            {formatIndianNumber(snapshot.principalPaid)}
          </p>
          {principalDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {principalDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-green-600" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  principalDiff.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {principalDiff.sign}
                {formatIndianNumber(principalDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Interest Paid Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-red-700">
            {formatIndianNumber(snapshot.interestPaid)}
          </p>
          {interestDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {interestDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-green-600" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  interestDiff.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {interestDiff.sign}
                {formatIndianNumber(interestDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* EMI Amount Column */}
      <div className="flex items-center">
        <p className="text-sm font-semibold text-blue-700">
          {formatIndianNumber(snapshot.emiAmount)}
        </p>
      </div>

      {/* Interest Rate Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-yellow-700">
            {snapshot.interestRate.toFixed(2)}%
          </p>
          {rateDiff && rateDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {rateDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-red-600" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-green-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  rateDiff.isPositive ? "text-red-600" : "text-green-600"
                }`}
              >
                {rateDiff.sign}
                {rateDiff.value.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Remaining Tenure Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-indigo-700">
            {snapshot.remainingTenureMonths} months
          </p>
          {tenureDiff && tenureDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {tenureDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-red-600" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-green-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  tenureDiff.isPositive ? "text-red-600" : "text-green-600"
                }`}
              >
                {tenureDiff.sign}
                {tenureDiff.value} months
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last Updated Column */}
      <div className="flex items-center">
        <div className="text-xs text-gray-600">
          <p className="font-medium">
            {new Date(snapshot.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-gray-500 mt-0.5">
            {new Date(snapshot.updatedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
