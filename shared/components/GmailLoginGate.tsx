'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Mail, Loader2, Shield, TrendingUp, Zap } from 'lucide-react';

interface GmailStatus {
  isConnected: boolean;
  hasTokens: boolean;
  isExpired: boolean;
  message: string;
}

interface GmailLoginGateProps {
  children: ReactNode;
}

export function GmailLoginGate({ children }: GmailLoginGateProps) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkStatus();
    // Poll status every 5 seconds to check if user logged in
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-tile via-accent-500 to-accent-700">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gain rounded-full border-4 border-white animate-pulse"></div>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-accent-700 mx-auto mb-3" />
          <p className="text-muted font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const isConnected = status?.isConnected || status?.hasTokens || false;

  // If not connected, show login screen
  if (!isConnected) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-tile via-accent-500 to-accent-700 p-4">
        <div className="bg-panel rounded-2xl shadow-2xl p-10 max-w-lg w-full mx-4 border border-divider">
          {/* Gmail Logo/Icon */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-loss via-warn to-gain rounded-2xl flex items-center justify-center mx-auto shadow-lg transform hover:scale-105 transition-transform">
                <Mail className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent rounded-full border-4 border-white"></div>
            </div>
            <h1 className="text-3xl font-bold text-ink mb-3 bg-gradient-to-r from-accent to-accent-700 bg-clip-text text-transparent">
              Login with Gmail
            </h1>
            <p className="text-muted text-lg">
              Connect your Gmail account to access your financial dashboard
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-accent to-accent-700 border border-accent-200">
              <TrendingUp className="w-5 h-5 text-accent-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">Auto-sync Investments</p>
                <p className="text-xs text-muted">Automatically extract investment data from emails</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-gain to-gain border border-divider">
              <Zap className="w-5 h-5 text-gain mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">Real-time Updates</p>
                <p className="text-xs text-muted">Keep your portfolio updated automatically</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-accent to-loss border border-accent-200">
              <Shield className="w-5 h-5 text-accent-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">Secure & Private</p>
                <p className="text-xs text-muted">Your data is encrypted and secure</p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isConnecting}
            className="w-full group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-accent to-accent-700 text-white rounded-xl hover:from-accent hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
                <span>Login with Gmail</span>
                <div className="absolute inset-0 bg-white/20 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              </>
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-muted mt-6">
            By logging in, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    );
  }

  // If connected, show the children (normal content)
  return <>{children}</>;
}
