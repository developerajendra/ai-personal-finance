'use client';

import { useState, useEffect } from 'react';
import { Mail, Link as LinkIcon, LogOut, RefreshCw, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface GmailStatus {
  isConnected: boolean;
  hasTokens: boolean;
  isExpired: boolean;
  message: string;
}

interface GmailConnectionTooltipProps {
  onClose?: () => void;
}

export function GmailConnectionTooltip({ onClose }: GmailConnectionTooltipProps) {
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
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 min-w-[320px]">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-gray-400" />
          <div className="text-sm text-gray-300">Checking Gmail status...</div>
        </div>
      </div>
    );
  }

  const isConnected = status?.isConnected || false;

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 min-w-[320px] max-w-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className={`w-5 h-5 ${isConnected ? 'text-green-400' : 'text-gray-400'}`} />
          <h3 className="text-sm font-semibold text-white">Gmail Integration</h3>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {isConnected
          ? 'Connected - Agent monitoring emails for investments'
          : 'Not connected - Connect to enable email-based investment creation'}
      </p>

      {status?.isExpired && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-300">
          Token expired. Please reconnect your Gmail account.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {isConnected ? (
          <>
            <button
              onClick={handleProcessEmails}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              {isProcessing ? 'Processing...' : 'Process Emails Now'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                <LogOut className="w-4 h-4" />
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
              <button
                onClick={checkStatus}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleLogin}
            disabled={isConnecting}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-md hover:shadow-lg transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
            </svg>
            {isConnecting ? 'Logging in...' : 'Login with Gmail'}
          </button>
        )}
      </div>

      {processStatus && (
        <div className={`mt-3 p-2 rounded text-xs ${
          processStatus.success 
            ? 'bg-green-900/30 border border-green-700 text-green-300' 
            : 'bg-red-900/30 border border-red-700 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <p>{processStatus.message}</p>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="mt-3 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
          <strong>How it works:</strong> The Portfolio Management Agent automatically monitors
          your Gmail for investment-related emails and creates draft investments for review.
        </div>
      )}
    </div>
  );
}

