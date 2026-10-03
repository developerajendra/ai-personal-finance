'use client';

import { useState, useEffect } from 'react';
import { Mail, Link as LinkIcon, LogOut, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { StatusDot } from '@/shared/components/ui';

interface GmailStatus {
  isConnected: boolean;
  hasTokens: boolean;
  isExpired: boolean;
  message: string;
}

export function GmailConnection() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/gmail/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/gmail/auth');
      const { loginUrl } = await response.json();
      if (loginUrl) {
        window.location.href = loginUrl;
      }
    } catch (error) {
      console.error('Error logging in with Gmail:', error);
      alert('Failed to login with Gmail. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? The agent will stop monitoring emails.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (response.ok) {
        await checkStatus();
        alert('Gmail disconnected successfully');
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      alert('Failed to disconnect Gmail. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleProcessEmails = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      const response = await fetch('/api/agents/email/process', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setProcessStatus({ 
          success: true, 
          message: `Processed ${data.result?.processedCount || 0} emails, created ${data.result?.investmentCount || 0} investments` 
        });
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
      <div className="flex items-center gap-3 border-b border-divider py-5 first:pt-0">
        <Mail className="w-4 h-4 text-muted" />
        <div className="text-[13.5px] text-muted">Checking Gmail status...</div>
      </div>
    );
  }

  const isConnected = status?.isConnected || false;

  return (
    <div className="border-b border-divider py-5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">Gmail</h3>
          <p className="mt-1 text-[13.5px] text-muted">
            {isConnected
              ? 'Agent monitoring emails for investments, loan summaries and rate changes.'
              : 'Loan quarterly summaries, rate changes, investment confirmations.'}
          </p>
        </div>
        {isConnected ? <StatusDot tone="gain">Connected</StatusDot> : <StatusDot>Not connected</StatusDot>}
      </div>

      {status?.isExpired && (
        <p className="mt-3 rounded-[12px] bg-warn-bg px-3 py-2 text-[13px] text-warn">Token expired. Please reconnect your Gmail account.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isConnected ? (
          <>
            <button onClick={handleProcessEmails} disabled={isProcessing} className="btn btn-primary btn-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              {isProcessing ? 'Processing...' : 'Process emails now'}
            </button>
            <button onClick={checkStatus} className="btn btn-secondary btn-sm">
              Refresh status
            </button>
            <button onClick={handleDisconnect} disabled={isDisconnecting} className="btn btn-danger btn-sm">
              <LogOut className="w-3.5 h-3.5" />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </>
        ) : (
          <button onClick={handleLogin} disabled={isConnecting} className="btn btn-ghost btn-sm !px-1.5">
            {isConnecting ? 'Logging in...' : 'Connect'}
          </button>
        )}
      </div>

      {processStatus && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2 text-[13px] ${processStatus.success ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss'}`}
          role="status"
        >
          <AlertCircle className="w-4 h-4" />
          {processStatus.message}
        </div>
      )}
    </div>
  );
}
