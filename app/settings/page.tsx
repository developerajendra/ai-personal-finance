"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { AppShell } from "@/shared/components/AppShell";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, Segmented, StatusDot } from "@/shared/components/ui";
import { AppearancePicker } from "@/shared/components/AppearancePicker";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { WhatsAppLinkCard } from "@/modules/settings/components/WhatsAppLinkCard";
import {
  Mail,
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

  const [zerodhaOpen, setZerodhaOpen] = useState(false);
  const { currency, setCurrency, hidden, setHidden } = useTheme();

  const connectGmail = async () => {
    const res = await fetch("/api/gmail/auth");
    const { loginUrl } = await res.json();
    if (loginUrl) window.location.href = loginUrl;
  };

  return (
    <AppShell>
      <PageHeader title="Settings" meta={false} />

      <div className="max-w-[760px] space-y-5">
        {success && (
          <div className="flex items-center gap-2 rounded-panel bg-gain-bg p-4 text-[14px] text-gain" role="status">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-panel bg-loss-bg p-4 text-[14px] text-loss" role="alert">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent-700" />
          </div>
        ) : (
          <>
            {/* Profile */}
            <Panel>
              <PanelHeader title="Profile" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Display name</span>
                  <input className="input" readOnly value={settings?.user.name || session?.user?.name || "—"} />
                </label>
                <label className="block">
                  <span className="field-label">Email</span>
                  <input className="input" readOnly value={settings?.user.email || session?.user?.email || "—"} />
                </label>
              </div>
              <div className="mt-4">
                <Button variant="danger" icon={LogOut} onClick={() => signOut({ callbackUrl: "/auth/signin" })}>
                  Sign out
                </Button>
              </div>
            </Panel>

            {/* Display */}
            <Panel>
              <PanelHeader title="Display" />
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[14px]">Currency</span>
                  <Segmented value={currency} onChange={setCurrency} options={["INR", "NPR"]} ariaLabel="Display currency" />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
                  Hide amounts (privacy mode)
                </label>
              </div>
              <p className="mt-4 text-[13.5px] text-muted">
                Numbers use Indian grouping (₹1,00,000.00). Money shows at most two decimals; units keep full precision internally.
              </p>
            </Panel>

            {/* Appearance */}
            <Panel>
              <PanelHeader title="Appearance" />
              <AppearancePicker />
            </Panel>

            {/* Connections */}
            <Panel>
              <PanelHeader title="Connections" />
              <ul>
                <li className="border-b border-divider py-4 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">Zerodha Kite Connect</div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        {settings?.zerodha.hasConfig
                          ? `API key ${settings.zerodha.api_key} · secret ${settings.zerodha.api_secret === "configured" ? "configured" : "not set"}`
                          : "Stocks and mutual fund holdings"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {settings?.zerodha.hasConfig ? <StatusDot tone="gain">Configured</StatusDot> : <StatusDot>Not configured</StatusDot>}
                      <Button variant="secondary" onClick={() => setZerodhaOpen(!zerodhaOpen)}>
                        {settings?.zerodha.hasConfig ? "Update keys" : "Connect"}
                      </Button>
                    </div>
                  </div>
                  {zerodhaOpen && (
                    <div className="mt-4 rounded-[14px] bg-tile p-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="field-label">API key</span>
                          <input type="text" value={zerodhaApiKey} onChange={(e) => setZerodhaApiKey(e.target.value)} className="input" placeholder="Enter API Key" />
                        </label>
                        <label className="block">
                          <span className="field-label">API secret</span>
                          <input type="password" value={zerodhaApiSecret} onChange={(e) => setZerodhaApiSecret(e.target.value)} className="input" placeholder="Enter API Secret" />
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          onClick={() => saveConfig("zerodha", { api_key: zerodhaApiKey, api_secret: zerodhaApiSecret })}
                          disabled={saving === "zerodha" || (!zerodhaApiKey && !zerodhaApiSecret)}
                          icon={saving === "zerodha" ? Loader2 : Save}
                        >
                          Save
                        </Button>
                        {settings?.zerodha.hasConfig && (
                          <Button variant="danger" icon={Trash2} onClick={() => disconnectProvider("zerodha")}>
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
                <li className="flex flex-wrap items-center justify-between gap-3 border-b border-divider py-4">
                  <div>
                    <div className="text-[15px] font-semibold">Gmail</div>
                    <div className="mt-0.5 text-[13px] text-muted">Loan quarterly summaries, rate changes, investment confirmations</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {settings?.gmail.hasTokens ? <StatusDot tone="gain">Connected</StatusDot> : <StatusDot>Not connected</StatusDot>}
                    <Button variant="secondary" icon={Mail} onClick={connectGmail}>
                      {settings?.gmail.hasTokens ? "Reconnect" : "Connect"}
                    </Button>
                    {settings?.gmail.hasTokens && (
                      <Button
                        variant="danger"
                        icon={Trash2}
                        onClick={async () => {
                          await fetch("/api/gmail/disconnect", { method: "POST" });
                          fetchSettings();
                        }}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </li>
                <li className="flex flex-wrap items-center justify-between gap-3 py-4 last:pb-0">
                  <div>
                    <div className="text-[15px] font-semibold">Google Drive</div>
                    <div className="mt-0.5 text-[13px] text-muted">No sign-in needed for public links</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusDot>Link import only</StatusDot>
                    <LinkButton href="/data/upload" variant="secondary">
                      Use a link
                    </LinkButton>
                  </div>
                </li>
              </ul>
            </Panel>

            {/* WhatsApp */}
            <WhatsAppLinkCard />

            {/* Advanced · AI provider */}
            <Panel>
              <PanelHeader title="Advanced · AI provider" subtitle="Optional. Override the default AI API key with your own." />
              {settings?.ai.api_key && (
                <p className="mb-4 rounded-[12px] bg-tile px-4 py-3 text-[13.5px] text-muted">Current key: {settings.ai.api_key}</p>
              )}
              <label className="block">
                <span className="field-label">Gemini API key</span>
                <input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} className="input" placeholder="Enter your Gemini API key" />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => saveConfig("ai", { api_key: aiApiKey })} disabled={saving === "ai" || !aiApiKey} icon={saving === "ai" ? Loader2 : Save}>
                  Save
                </Button>
                {settings?.ai.api_key && (
                  <Button variant="danger" icon={Trash2} onClick={() => disconnectProvider("ai")}>
                    Remove
                  </Button>
                )}
                <span className="text-[13px] text-muted">{settings?.ai.api_key ? "Using your key" : "Using the default key"}</span>
              </div>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
