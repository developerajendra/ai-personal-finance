"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Sidebar } from "@/shared/components/Sidebar";
import {
  Settings,
  Key,
  Mail,
  Sparkles,
  User,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  LogOut,
} from "lucide-react";

interface SettingsData {
  zerodha: { api_key: string | null; api_secret: string | null; hasConfig: boolean };
  gmail: { hasTokens: boolean };
  ai: { api_key: string | null };
  user: { name: string | null; email: string };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [zerodhaApiKey, setZerodhaApiKey] = useState("");
  const [zerodhaApiSecret, setZerodhaApiSecret] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (provider: string, configs: Record<string, string>) => {
    setSaving(provider);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, configs }),
      });

      if (res.ok) {
        setSuccess(`${provider} configuration saved successfully`);
        fetchSettings();
        if (provider === "zerodha") {
          setZerodhaApiKey("");
          setZerodhaApiSecret("");
        } else if (provider === "ai") {
          setAiApiKey("");
        }
      } else {
        setError("Failed to save configuration");
      }
    } catch {
      setError("Failed to save configuration");
    } finally {
      setSaving(null);
    }
  };

  const disconnectProvider = async (provider: string) => {
    setSaving(provider);
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setSuccess(`${provider} disconnected`);
        fetchSettings();
      }
    } catch {
      setError("Failed to disconnect");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="flex items-center gap-3 mb-8">
            <Settings className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          </div>

          {success && (
            <div className="mb-6 flex items-center gap-2 bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center gap-2 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
              <XCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                    <p className="text-gray-900 font-medium">{settings?.user.name || session?.user?.name || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                    <p className="text-gray-900 font-medium">{settings?.user.email || session?.user?.email || "—"}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </section>

              {/* Zerodha Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-orange-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Zerodha Kite Connect</h2>
                  </div>
                  {settings?.zerodha.hasConfig && (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
                      <CheckCircle className="w-4 h-4" /> Configured
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Connect your Zerodha account to automatically sync stocks and mutual funds.
                </p>
                {settings?.zerodha.hasConfig && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    <p>API Key: {settings.zerodha.api_key}</p>
                    <p>API Secret: {settings.zerodha.api_secret === "configured" ? "***configured***" : "Not set"}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input
                      type="text"
                      value={zerodhaApiKey}
                      onChange={(e) => setZerodhaApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Enter API Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                    <input
                      type="password"
                      value={zerodhaApiSecret}
                      onChange={(e) => setZerodhaApiSecret(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Enter API Secret"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => saveConfig("zerodha", { api_key: zerodhaApiKey, api_secret: zerodhaApiSecret })}
                    disabled={saving === "zerodha" || (!zerodhaApiKey && !zerodhaApiSecret)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {saving === "zerodha" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                  {settings?.zerodha.hasConfig && (
                    <button
                      onClick={() => disconnectProvider("zerodha")}
                      className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Disconnect
                    </button>
                  )}
                </div>
              </section>

              {/* Gmail Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-red-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Gmail Integration</h2>
                  </div>
                  {settings?.gmail.hasTokens && (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Connect Gmail to automatically extract investment data from your emails.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/gmail/auth");
                      const { loginUrl } = await res.json();
                      if (loginUrl) window.location.href = loginUrl;
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium"
                  >
                    <Mail className="w-4 h-4" />
                    {settings?.gmail.hasTokens ? "Reconnect Gmail" : "Connect Gmail"}
                  </button>
                  {settings?.gmail.hasTokens && (
                    <button
                      onClick={async () => {
                        await fetch("/api/gmail/disconnect", { method: "POST" });
                        fetchSettings();
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Disconnect
                    </button>
                  )}
                </div>
              </section>

              {/* AI Configuration */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h2 className="text-xl font-semibold text-gray-900">AI Configuration</h2>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Optionally override the default AI API key with your own.
                </p>
                {settings?.ai.api_key && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    Current key: {settings.ai.api_key}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    placeholder="Enter your Gemini API key"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => saveConfig("ai", { api_key: aiApiKey })}
                    disabled={saving === "ai" || !aiApiKey}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {saving === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                  {settings?.ai.api_key && (
                    <button
                      onClick={() => disconnectProvider("ai")}
                      className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
