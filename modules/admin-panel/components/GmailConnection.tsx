'use client';

import { useState, useEffect } from 'react';
import { Mail, Link as LinkIcon, LogOut, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

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

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/gmail/auth');
      const { loginUrl } = await response.json();
      if (loginUrl) {
        window.location.href = loginUrl;
      }
    } catch (error) {
      console.error('Error connecting to Gmail:', error);
      alert('Failed to connect to Gmail. Please try again.');
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-gray-400" />
          <div className="text-sm text-gray-500">Checking Gmail status...</div>
        </div>
      </div>
    );
  }

  const isConnected = status?.isConnected || false;

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Mail className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
          <div>
            <h3 className="text-lg font-semibold">Gmail Integration</h3>
            <p className="text-sm text-gray-500">
              {isConnected
                ? 'Connected - Agent monitoring emails for investments'
                : 'Not connected - Connect to enable email-based investment creation'}
            </p>
          </div>
        </div>
        {isConnected ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-gray-400" />
        )}
      </div>

      {status?.isExpired && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Token expired. Please reconnect your Gmail account.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {isConnected ? (
          <>
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <LogOut className="w-4 h-4" />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
            <button
              onClick={checkStatus}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              <RefreshCw className="w-4 h-4" />
              Refresh Status
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <LinkIcon className="w-4 h-4" />
            {isConnecting ? 'Connecting...' : 'Connect Gmail'}
          </button>
        )}
      </div>

      {isConnected && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> The Portfolio Management Agent automatically monitors
            your Gmail for investment-related emails. When it finds an email with investment
            information, it extracts the data and creates a draft investment for your review.
          </p>
        </div>
      )}
    </div>
  );
}

