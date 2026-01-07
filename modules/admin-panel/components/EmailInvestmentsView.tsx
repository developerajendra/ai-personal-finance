'use client';

import { useState, useEffect } from 'react';
import { Mail, FileText, Calendar, DollarSign, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Investment } from '@/core/types';

interface EmailInvestment extends Investment {
  emailSubject?: string;
  emailDate?: string;
  confidence?: number;
}

export function EmailInvestmentsView() {
  const [investments, setInvestments] = useState<EmailInvestment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    loadEmailInvestments();
  }, []);

  const loadEmailInvestments = async () => {
    try {
      // Load all draft investments (email-created investments are drafts)
      const response = await fetch('/api/portfolio/investments?isPublished=false');
      if (response.ok) {
        const data = await response.json();
        // Filter investments created from email (check tags, description, or ID pattern)
        const emailInvestments = (Array.isArray(data) ? data : data.data || []).filter(
          (inv: Investment) =>
            inv.tags?.includes('added from gmail') ||
            inv.description?.toLowerCase().includes('email') ||
            inv.description?.toLowerCase().includes('extracted from email') ||
            inv.id.startsWith('inv-email-') ||
            inv.id.includes('email')
        );
        setInvestments(emailInvestments);
      }
    } catch (error) {
      console.error('Error loading email investments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessEmails = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      const response = await fetch('/api/agents/email/process', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setProcessStatus({ success: true, message: `Processed ${data.result?.processedCount || 0} emails, created ${data.result?.investmentCount || 0} investments` });
        // Reload investments after processing
        setTimeout(() => {
          loadEmailInvestments();
        }, 2000);
      } else {
        setProcessStatus({ success: false, message: data.error || 'Failed to process emails' });
      }
    } catch (error: any) {
      setProcessStatus({ success: false, message: error.message || 'Error processing emails' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="text-center text-gray-500">Loading email investments...</div>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-gray-400" />
            <h3 className="text-lg font-semibold">Investments from Email</h3>
          </div>
          <button
            onClick={handleProcessEmails}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing...' : 'Process Emails Now'}
          </button>
        </div>

        {processStatus && (
          <div className={`mb-4 p-3 rounded ${
            processStatus.success 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{processStatus.message}</p>
            </div>
          </div>
        )}

        <div className="text-center py-8 text-gray-500">
          <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No investments created from emails yet.</p>
          <p className="text-sm mt-2">
            Connect Gmail and send an email with investment information, then click "Process Emails Now" to process them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold">Investments from Email</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessEmails}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing...' : 'Process Emails Now'}
          </button>
          <span className="text-sm text-gray-500">{investments.length} draft(s)</span>
        </div>
      </div>

      {processStatus && (
        <div className={`mb-4 p-3 rounded ${
          processStatus.success 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{processStatus.message}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {investments.map((investment) => (
          <div
            key={investment.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{investment.name}</h4>
                {investment.description && (
                  <p className="text-sm text-gray-500 mt-1">{investment.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                  Draft
                </span>
                {investment.tags?.includes('added from gmail') && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                    📧 Added from Gmail
                  </span>
                )}
                {investment.confidence && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {Math.round(investment.confidence * 100)}% confidence
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Amount</div>
                  <div className="font-semibold">₹{investment.amount.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="font-semibold capitalize">{investment.type}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Start Date</div>
                  <div className="font-semibold text-sm">
                    {new Date(investment.startDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {investment.interestRate && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">Interest Rate</div>
                    <div className="font-semibold">{investment.interestRate}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

