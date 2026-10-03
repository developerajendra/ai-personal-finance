'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoanMonthlySnapshot, Loan } from '@/shared/types';
import { formatIndianNumber } from '@/shared/utils/currency';
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
} from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/Tabs';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PAYMENT_DAY = 4; // Loan EMI is paid on the 4th of every month

/** Loads every loan snapshot across all years, latest first (shared by the loan hero). */
export async function fetchLoanSnapshots(): Promise<{ snapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }> }> {
  // Get all available years first
  const yearsResponse = await fetch('/api/loans/analytics?action=years');
  if (!yearsResponse.ok) {
    return { snapshots: [] };
  }
  const yearsData = await yearsResponse.json();
  const years = yearsData.years || [];

  // Fetch snapshots for all years
  const allSnapshots: Array<{
    snapshot: LoanMonthlySnapshot;
    growth: any;
  }> = [];
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
}

export function LoanAnalyticsModule() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const dayOfMonth = new Date().getDate();
  const shouldAutoUpdate = dayOfMonth >= PAYMENT_DAY;
  const [activeTab, setActiveTab] = useState<'analytics' | 'settings'>(
    'analytics',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const autoUpdateRan = useRef(false);

  // Auto-update: generate missing monthly snapshots when date >= 4th
  useEffect(() => {
    if (!shouldAutoUpdate || autoUpdateRan.current) return;
    autoUpdateRan.current = true;

    const run = async () => {
      try {
        console.log('[LoanAnalytics] Auto-updating missing monthly snapshots...');
        const res = await fetch('/api/loans/auto-update', { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.generated > 0) {
          console.log(`[LoanAnalytics] Generated ${data.generated} snapshot(s), refreshing...`);
          queryClient.invalidateQueries({ queryKey: ['loan-analytics-snapshots'] });
        }
      } catch {
        // Silently ignore - this is a best-effort background update
      }
    };
    run();
  }, [shouldAutoUpdate, queryClient]);

  // Fetch loans to get loan names
  const { data: loansData } = useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
  });

  // Fetch email metadata
  const { data: emailMetadataData } = useQuery<{ metadata: any[] }>({
    queryKey: ['loan-email-metadata'],
    queryFn: async () => {
      const response = await fetch('/api/loans/email-metadata');
      if (!response.ok) throw new Error('Failed to fetch email metadata');
      return response.json();
    },
  });

  // Fetch all snapshots (latest first)
  const {
    data: snapshotsData,
    isLoading,
    refetch: refetchSnapshots,
  } = useQuery<{
    snapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }>;
  }>({
    queryKey: ['loan-analytics-snapshots'],
    queryFn: fetchLoanSnapshots,
  });

  const snapshots = snapshotsData?.snapshots || [];
  const loans = loansData || [];

  // Group snapshots by year and month (show latest first)
  const snapshotMap = new Map<
    string,
    Array<{ snapshot: LoanMonthlySnapshot; growth: any }>
  >();
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
    },
  );

  const avgOutstanding =
    snapshots.length > 0 ? yearTotals.totalOutstanding / snapshots.length : 0;

  if (isLoading) {
    return (
      <div>
        <div className="mt-8">
          <Loader text="Loading loan analytics..." size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'analytics' | 'settings')}>
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Email Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          {/* Fetch Latest Email Button */}
          <div className="mt-4 panel px-6 py-[22px]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[19px] text-ink">
                  Monthly snapshots
                </h2>
                <p className="text-sm text-muted mt-1">
                  Automatically fetch and process loan-related emails (quarterly
                  summaries and interest rate changes)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      setIsProcessing(true);
                      setProcessStatus(null);
                      const response = await fetch('/api/loans/fetch-latest', {
                        method: 'POST',
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
                          queryClient.invalidateQueries({
                            queryKey: ['loan-email-metadata'],
                          });
                        }, 2000);
                      } else {
                        setProcessStatus({
                          success: false,
                          message:
                            data.error || 'Failed to fetch latest loan summary',
                        });
                      }
                    } catch (error: any) {
                      setProcessStatus({
                        success: false,
                        message:
                          error.message || 'Error fetching latest loan summary',
                      });
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing}
                  className="btn btn-secondary">
                  {isProcessing ? (
                    <>
                      <Loader text="" size="sm" />
                      <span>Fetching Latest Email...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Fetch quarterly summary</span>
                    </>
                  )}
                </button>
                <button
                  onClick={async () => {
                    try {
                      setIsProcessing(true);
                      setProcessStatus(null);
                      const response = await fetch(
                        '/api/loans/fetch-rate-change',
                        {
                          method: 'POST',
                        },
                      );
                      const data = await response.json();

                      if (data.success) {
                        setProcessStatus({
                          success: true,
                          message:
                            data.message ||
                            `Successfully updated interest rate from ${data.extractedData.oldRate}% to ${data.extractedData.newRate}% (effective ${data.extractedData.effectiveDate}). Updated ${data.result.updatedSnapshots} snapshot(s).`,
                        });
                        // Refetch snapshots and metadata after processing
                        setTimeout(() => {
                          refetchSnapshots();
                          queryClient.invalidateQueries({
                            queryKey: ['loan-email-metadata'],
                          });
                        }, 2000);
                      } else {
                        setProcessStatus({
                          success: false,
                          message:
                            data.error ||
                            'Failed to fetch interest rate change email',
                        });
                      }
                    } catch (error: any) {
                      setProcessStatus({
                        success: false,
                        message:
                          error.message ||
                          'Error fetching interest rate change email',
                      });
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing}
                  className="btn btn-secondary">
                  {isProcessing ? (
                    <>
                      <Loader text="" size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Percent className="w-5 h-5" />
                      <span>Check rate change</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            {processStatus && (
              <div
                className={`mt-4 p-3 rounded-lg ${
                  processStatus.success
                    ? 'bg-gain-bg text-gain border border-divider'
                    : 'bg-loss-bg text-loss border border-divider'
                }`}>
                <p className="text-sm">{processStatus.message}</p>
              </div>
            )}
          </div>

          {/* Email Metadata Display */}
          {emailMetadataData?.metadata &&
            emailMetadataData.metadata.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Data Source Information */}
                <div className="rounded-[14px] bg-tile p-4">
                  <h3 className="text-sm font-semibold text-accent-800 mb-3">
                    Data Source Information
                  </h3>
                  <div className="space-y-4">
                    {emailMetadataData.metadata.map((meta: any) => {
                      const firstEmailDate = new Date(meta.firstEmailDate);
                      const lastEmailDate = new Date(meta.lastEmailDate);

                      return (
                        <div key={meta.loanId} className="text-sm text-accent-800">
                          <div className="mb-2">
                            <p className="font-medium">
                              📧 First Email:{' '}
                              <span className="font-normal">
                                {meta.firstEmailTitle}
                              </span>
                            </p>
                            <p className="text-xs text-accent-700 mt-1">
                              Date: {firstEmailDate.toLocaleDateString()} |
                              Starting Point:{' '}
                              {firstEmailDate.toLocaleDateString()}
                            </p>
                          </div>

                          {meta.lastEmailDate !== meta.firstEmailDate && (
                            <div className="mb-2">
                              <p className="font-medium">
                                📧 Latest Email:{' '}
                                <span className="font-normal">
                                  {meta.lastEmailTitle}
                                </span>
                              </p>
                              <p className="text-xs text-accent-700 mt-1">
                                Date: {lastEmailDate.toLocaleDateString()} | Total
                                Emails Processed: {meta.totalEmailsProcessed}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: All Processed Emails */}
                {(() => {
                  const allEmails = emailMetadataData.metadata.flatMap(
                    (meta: any) => meta.emails || [],
                  );
                  if (allEmails.length === 0) return null;
                  return (
                    <div className="rounded-[14px] bg-tile p-4">
                      <h3 className="text-sm font-semibold text-accent-800 mb-3">
                        All Processed Emails ({allEmails.length})
                      </h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allEmails.map((email: any, idx: number) => {
                          const emailDate = new Date(email.emailDate);
                          const isRateChange =
                            email.emailTitle
                              ?.toLowerCase()
                              .includes('interest rate') ||
                            email.emailTitle
                              ?.toLowerCase()
                              .includes('rate change');
                          return (
                            <div
                              key={email.emailId || idx}
                              className="text-xs bg-panel rounded-md px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    isRateChange
                                      ? 'text-warn'
                                      : 'text-accent-700'
                                  }>
                                  {isRateChange ? '📊' : '📧'}
                                </span>
                                <span className="font-medium truncate flex-1">
                                  {email.emailTitle}
                                </span>
                                <span className="text-accent-700 whitespace-nowrap">
                                  {emailDate.toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          {/* Summary Header */}
          {snapshots.length > 0 && (
            <div className="mt-4 panel px-6 py-[22px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[19px] text-ink">Loan analytics summary</h2>
                  <p className="text-muted text-[13.5px] mt-1">
                    {snapshots.length} snapshot
                    {snapshots.length !== 1 ? 's' : ''} recorded
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="eyebrow">
                      Latest Outstanding
                    </p>
                    <p className="text-xl font-bold text-ink mt-1">
                      {formatIndianNumber(
                        snapshots[0]?.snapshot.outstandingAmount || 0,
                      )}
                    </p>
                  </div>
                  <div className="w-px h-12 bg-divider"></div>
                  <div className="text-right">
                    <p className="eyebrow">
                      Total Principal Paid
                    </p>
                    <p className="text-xl font-bold text-ink mt-1">
                      {formatIndianNumber(yearTotals.totalPrincipalPaid)}
                    </p>
                  </div>
                  <div className="w-px h-12 bg-divider"></div>
                  <div className="text-right">
                    <p className="eyebrow">
                      Total Interest Paid
                    </p>
                    <p className="text-xl font-bold text-ink mt-1">
                      {formatIndianNumber(yearTotals.totalInterestPaid)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Grid */}
          {snapshotKeys.length === 0 ? (
            <div className="mt-4 bg-warn-bg rounded-panel p-6 text-center">
              <p className="text-warn mb-4">
                No loan snapshots available. Click "Fetch Latest Quarterly
                Summary" to process the latest email.
              </p>
            </div>
          ) : (
            <div className="mt-4 panel overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-8 gap-3 p-3 bg-tile font-semibold text-[11.5px] uppercase tracking-wide text-muted">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Month</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-accent-700" />
                  <span>Outstanding</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-gain" />
                  <span>Principal Paid</span>
                </div>
                <div className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-loss" />
                  <span>Interest Paid till date</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-accent-700" />
                  <span>EMI Amount</span>
                </div>
                <div className="flex items-center gap-1">
                  <Percent className="w-3 h-3 text-warn" />
                  <span>Interest Rate</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent-700" />
                  <span>Remaining Tenure</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted" />
                  <span>Last Updated</span>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-divider">
                {snapshotKeys.map((key) => {
                  const [year, month] = key.split('-').map(Number);
                  const monthSnapshots = snapshotMap.get(key) || [];
                  return monthSnapshots.map((item, index) => {
                    const { snapshot, growth } = item;
                    const loan = loans.find((l) => l.id === snapshot.loanId);
                    const loanName = loan?.name || 'Unknown Loan';

                    return (
                      <LoanMonthRow
                        key={`${snapshot.id}-${index}`}
                        month={month}
                        monthName={FULL_MONTHS[month - 1]}
                        year={year}
                        snapshot={snapshot}
                        growth={growth}
                        loanName={loanName}
                        isCurrentMonth={
                          month === currentMonth && year === currentYear
                        }
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
  const [newPatternTitle, setNewPatternTitle] = useState('');
  const [newPatternType, setNewPatternType] = useState<
    'quarterly-summary' | 'interest-rate-change' | 'other'
  >('quarterly-summary');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const queryClient = useQueryClient();

  // Fetch email patterns
  const { data: patternsData, isLoading } = useQuery<{ patterns: any[] }>({
    queryKey: ['loan-email-patterns'],
    queryFn: async () => {
      const response = await fetch('/api/loans/email-patterns');
      if (!response.ok) throw new Error('Failed to fetch patterns');
      return response.json();
    },
  });

  const patterns = patternsData?.patterns || [];

  const handleAddPattern = async () => {
    if (!newPatternTitle.trim()) {
      alert('Please enter an email title pattern');
      return;
    }

    try {
      const response = await fetch('/api/loans/email-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPatternTitle,
          type: newPatternType,
          enabled: true,
        }),
      });

      if (response.ok) {
        setNewPatternTitle('');
        queryClient.invalidateQueries({ queryKey: ['loan-email-patterns'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add pattern');
      }
    } catch (error: any) {
      alert('Error adding pattern: ' + error.message);
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email pattern?')) {
      return;
    }

    try {
      const response = await fetch(`/api/loans/email-patterns?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['loan-email-patterns'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete pattern');
      }
    } catch (error: any) {
      alert('Error deleting pattern: ' + error.message);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const response = await fetch('/api/loans/email-patterns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          enabled: !currentEnabled,
        }),
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['loan-email-patterns'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update pattern');
      }
    } catch (error: any) {
      alert('Error updating pattern: ' + error.message);
    }
  };

  const handleStartEdit = (pattern: any) => {
    setEditingId(pattern.id);
    setEditTitle(pattern.title);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) {
      alert('Please enter an email title pattern');
      return;
    }

    try {
      const response = await fetch('/api/loans/email-patterns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editTitle,
        }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditTitle('');
        queryClient.invalidateQueries({ queryKey: ['loan-email-patterns'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update pattern');
      }
    } catch (error: any) {
      alert('Error updating pattern: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
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
      <div className="panel p-6">
        <h2 className="text-xl font-semibold text-ink mb-4">
          Email Title Patterns
        </h2>

        {/* Add New Pattern Form - Inline */}
        <div className="mb-6 p-4 bg-tile rounded-lg border border-divider">
          <h3 className="text-sm font-semibold text-neutral-800 mb-3">
            Add New Pattern
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Email Title Pattern
              </label>
              <input
                type="text"
                value={newPatternTitle}
                onChange={(e) => setNewPatternTitle(e.target.value)}
                placeholder="e.g., Quarterly Loan Summary Update"
                className="w-full px-3 py-2 text-sm border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPattern();
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Pattern Type
              </label>
              <select
                value={newPatternType}
                onChange={(e) =>
                  setNewPatternType(
                    e.target.value as
                      | 'quarterly-summary'
                      | 'interest-rate-change'
                      | 'other',
                  )
                }
                className="w-full px-3 py-2 text-sm border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]">
                <option value="quarterly-summary">Quarterly Summary</option>
                <option value="interest-rate-change">
                  Interest Rate Change
                </option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddPattern}
                className="w-full px-4 py-2 bg-accent text-white hover:bg-accent-700 transition-colors flex items-center justify-center gap-2 text-sm rounded-pill font-medium">
                <Plus className="w-4 h-4" />
                <span>Add Pattern</span>
              </button>
            </div>
          </div>
        </div>

        {/* Existing Patterns */}
        <div>
          {patterns.length === 0 ? (
            <p className="text-muted text-center py-8">
              No email patterns configured. Add one above.
            </p>
          ) : (
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center justify-between p-4 border border-divider rounded-lg hover:bg-tile transition-colors">
                  <div className="flex-1">
                    {editingId === pattern.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(pattern.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(pattern.id)}
                          className="px-3 py-1.5 bg-accent text-white hover:bg-accent-700 text-sm rounded-pill font-medium">
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-neutral-200 text-neutral-800 rounded hover:bg-neutral-300 text-sm">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-ink">
                            {pattern.title}
                          </p>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              pattern.type === 'quarterly-summary'
                                ? 'bg-accent-100 text-accent-700'
                                : pattern.type === 'interest-rate-change'
                                  ? 'bg-warn-bg text-warn'
                                  : 'bg-tile text-neutral-800'
                            }`}>
                            {pattern.type === 'quarterly-summary'
                              ? 'Quarterly'
                              : pattern.type === 'interest-rate-change'
                                ? 'Rate Change'
                                : 'Other'}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              pattern.enabled
                                ? 'bg-gain-bg text-gain'
                                : 'bg-tile text-neutral-800'
                            }`}>
                            {pattern.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          Created:{' '}
                          {new Date(pattern.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {editingId !== pattern.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleToggleEnabled(pattern.id, pattern.enabled)
                        }
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          pattern.enabled
                            ? 'bg-gain-bg text-gain hover:bg-gain-bg'
                            : 'bg-tile text-neutral-800 hover:bg-neutral-200'
                        }`}>
                        {pattern.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleStartEdit(pattern)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-tile rounded transition-colors"
                        title="Edit pattern">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="p-1.5 text-loss hover:text-loss hover:bg-loss-bg rounded transition-colors"
                        title="Delete pattern">
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
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const queryClient = useQueryClient();

  // Fetch global reference data
  const { data: referenceDataResponse } = useQuery<{ referenceData: any }>({
    queryKey: ['loan-reference-data'],
    queryFn: async () => {
      const response = await fetch('/api/loans/reference-data');
      if (!response.ok) throw new Error('Failed to fetch reference data');
      return response.json();
    },
  });

  const referenceData = referenceDataResponse?.referenceData;
  const dataEntries = referenceData?.data
    ? Object.entries(referenceData.data)
    : [];

  const handleAddKeyValue = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      alert('Please enter both key and value');
      return;
    }

    try {
      const numericValue = parseFloat(newValue.replace(/,/g, ''));
      const value = isNaN(numericValue) ? newValue : numericValue;

      const response = await fetch('/api/loans/reference-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          value,
        }),
      });

      if (response.ok) {
        setNewKey('');
        setNewValue('');
        queryClient.invalidateQueries({ queryKey: ['loan-reference-data'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add reference data');
      }
    } catch (error: any) {
      alert('Error adding reference data: ' + error.message);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/loans/reference-data?key=${encodeURIComponent(key)}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['loan-reference-data'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete reference data');
      }
    } catch (error: any) {
      alert('Error deleting reference data: ' + error.message);
    }
  };

  const handleStartEdit = (key: string, value: string | number) => {
    setEditingKey(key);
    setEditValue(String(value));
  };

  const handleSaveEdit = async () => {
    if (!editingKey || !editValue.trim()) {
      alert('Please enter a value');
      return;
    }

    try {
      const numericValue = parseFloat(editValue.replace(/,/g, ''));
      const value = isNaN(numericValue) ? editValue : numericValue;

      const response = await fetch('/api/loans/reference-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editingKey,
          value,
        }),
      });

      if (response.ok) {
        setEditingKey(null);
        setEditValue('');
        queryClient.invalidateQueries({ queryKey: ['loan-reference-data'] });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update reference data');
      }
    } catch (error: any) {
      alert('Error updating reference data: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  return (
    <div className="panel p-6">
      <h2 className="text-xl font-semibold text-ink mb-4">
        Loan Reference Data
      </h2>
      <p className="text-sm text-muted mb-4">
        Add loan details that are not in the email (e.g., Disbursement Amount).
        AI will analyze this data FIRST before processing emails and use it for
        calculations.
      </p>

      {/* Add New Key-Value */}
      <div className="mb-6 p-4 bg-tile rounded-lg border border-divider">
        <h3 className="text-sm font-semibold text-neutral-800 mb-3">
          Add Reference Data
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Key (e.g., Disbursement Amount)
            </label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g., Disbursement Amount"
              className="w-full px-3 py-2 text-sm border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddKeyValue();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Value
            </label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g., 23,11,386"
              className="w-full px-3 py-2 text-sm border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddKeyValue();
              }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddKeyValue}
              className="w-full px-4 py-2 bg-accent text-white hover:bg-accent-700 transition-colors flex items-center justify-center gap-2 text-sm rounded-pill font-medium">
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Existing Reference Data */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-800 mb-3">
          Existing Reference Data
        </h3>
        {dataEntries.length === 0 ? (
          <p className="text-muted text-center py-8 text-sm">
            No reference data configured. Add key-value pairs above.
          </p>
        ) : (
          <div className="space-y-2">
            {dataEntries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 border border-divider rounded-lg hover:bg-tile transition-colors">
                {editingKey === key ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium text-neutral-800 min-w-[150px]">
                      {key}:
                    </span>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 bg-accent text-white hover:bg-accent-700 text-sm rounded-pill font-medium">
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-neutral-200 text-neutral-800 rounded hover:bg-neutral-300 text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-ink">
                        {key}:
                      </span>
                      <span className="text-sm text-neutral-800 ml-2">
                        {typeof value === 'number'
                          ? formatIndianNumber(value)
                          : String(value ?? '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(key, typeof value === 'number' || typeof value === 'string' ? value : String(value))}
                        className="p-1.5 text-muted hover:text-ink hover:bg-tile rounded transition-colors"
                        title="Edit value">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key)}
                        className="p-1.5 text-loss hover:text-loss hover:bg-loss-bg rounded transition-colors"
                        title="Delete">
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
      sign: isPositive ? '+' : '-',
      display: isPercent
        ? `${isPositive ? '+' : ''}${absValue.toFixed(2)}%`
        : `${isPositive ? '+' : ''}${formatIndianNumber(absValue)}`,
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
  const tenureDiff = growth?.tenureChange
    ? formatDifference(growth.tenureChange)
    : null;

  return (
    <div
      className={`grid grid-cols-8 gap-3 p-3 hover:bg-tile transition-colors border-l-4 ${
        isCurrentMonth
          ? 'bg-accent-100 border-accent'
          : 'bg-panel border-gain'
      }`}>
      {/* Month Column */}
      <div className="flex items-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">
              {MONTHS[month - 1]} {year}
            </p>
            <p className="text-sm font-semibold text-ink truncate">
              {monthName} {year}
            </p>
            <p className="text-xs text-muted truncate">{loanName}</p>
            {isCurrentMonth && (
              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-accent-100 text-accent-700 text-xs font-medium rounded">
                Latest
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Amount Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-accent-700">
            {formatIndianNumber(snapshot.outstandingAmount)}
          </p>
          {outstandingDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {outstandingDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  outstandingDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
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
          <p className="text-sm font-semibold text-gain">
            {formatIndianNumber(snapshot.principalPaid)}
          </p>
          {principalDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {principalDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  principalDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
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
          <p className="text-sm font-semibold text-loss">
            {formatIndianNumber(snapshot.interestPaid)}
          </p>
          {interestDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {interestDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  interestDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
                {interestDiff.sign}
                {formatIndianNumber(interestDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* EMI Amount Column */}
      <div className="flex items-center">
        <p className="text-sm font-semibold text-accent-700">
          {formatIndianNumber(snapshot.emiAmount)}
        </p>
      </div>

      {/* Interest Rate Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-warn">
            {snapshot.interestRate.toFixed(2)}%
          </p>
          {rateDiff && rateDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {rateDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-loss" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-gain" />
              )}
              <span
                className={`text-xs font-medium ${
                  rateDiff.isPositive ? 'text-loss' : 'text-gain'
                }`}>
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
          <p className="text-sm font-semibold text-accent-700">
            {snapshot.remainingTenureMonths} months
          </p>
          {tenureDiff && tenureDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {tenureDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-loss" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-gain" />
              )}
              <span
                className={`text-xs font-medium ${
                  tenureDiff.isPositive ? 'text-loss' : 'text-gain'
                }`}>
                {tenureDiff.sign}
                {tenureDiff.value} months
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last Updated Column */}
      <div className="flex items-center">
        <div className="text-xs text-muted">
          <p className="font-medium">
            {new Date(snapshot.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-muted mt-0.5">
            {new Date(snapshot.updatedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
