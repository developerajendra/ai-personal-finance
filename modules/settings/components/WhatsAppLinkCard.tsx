"use client";

import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle, Loader2, Trash2, XCircle } from "lucide-react";

interface LinkStatus {
  status: "none" | "pending" | "verified";
  phoneNumber?: string;
  codeExpiresAt?: string | null;
}

export function WhatsAppLinkCard() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [pendingCode, setPendingCode] = useState<{ code: string; instructions: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [health, setHealth] = useState<{ ready: boolean; webhookUrl: string; checks: { key: string; label: string; ok: boolean; detail: string }[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const runHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/integrations/whatsapp/health");
      if (res.ok) setHealth(await res.json());
    } finally {
      setChecking(false);
    }
  };

  const load = async () => {
    const res = await fetch("/api/integrations/whatsapp/link");
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => {
    load();
    runHealth();
  }, []);

  const startLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start linking");
      setPendingCode({ code: data.code, instructions: data.instructions });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start linking");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    await fetch("/api/integrations/whatsapp/link", { method: "DELETE" });
    setPendingCode(null);
    await load();
    setBusy(false);
  };

  return (
    <section id="whatsapp" className="panel px-6 py-[22px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-accent-700" />
          <h2 className="text-[19px] text-ink">WhatsApp</h2>
        </div>
        {status?.status === "verified" && (
          <span className="tag tag-gain font-semibold">
            <CheckCircle className="w-3.5 h-3.5" /> Linked +{status.phoneNumber}
          </span>
        )}
      </div>
      <p className="text-muted text-[13.5px] mb-4">
        Link your WhatsApp number to log expenses, add investments and ask questions by message.
      </p>

      {status?.status !== "verified" && (
        <div className="mb-4">
          <label className="field-label">WhatsApp number (with country code)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="+91 98765 43210"
          />
        </div>
      )}

      {pendingCode && status?.status === "pending" && (
        <div className="mb-4 rounded-[12px] bg-tile p-4 text-[13.5px] text-muted">
          <div className="mb-1 font-mono text-[19px] font-semibold text-ink">LINK {pendingCode.code}</div>
          {pendingCode.instructions}
        </div>
      )}
      {error && <div className="mb-4 rounded-[12px] bg-loss-bg p-3 text-[13.5px] text-loss" role="alert">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {status?.status !== "verified" && (
          <button
            onClick={startLink}
            disabled={busy || phone.trim().length < 8}
            className="btn btn-primary"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {status?.status === "pending" ? "Get a new code" : "Get link code"}
          </button>
        )}
        {status && status.status !== "none" && (
          <button
            onClick={unlink}
            disabled={busy}
            className="btn btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            Unlink
          </button>
        )}
      </div>

      {/* Setup checklist: which server settings WhatsApp + AI replies still need */}
      {health && (
        <div className="mt-5 rounded-[14px] bg-tile p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">{health.ready ? "WhatsApp is fully configured" : "Server setup needed"}</span>
            <button onClick={runHealth} disabled={checking} className="btn btn-ghost btn-sm">
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Re-check
            </button>
          </div>
          <ul className="space-y-2">
            {health.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-[13px]">
                {c.ok ? <CheckCircle className="mt-0.5 h-4 w-4 flex-none text-gain" /> : <XCircle className="mt-0.5 h-4 w-4 flex-none text-loss" />}
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">
            Webhook callback URL for Meta: <code className="rounded bg-panel px-1.5 py-0.5 text-ink">{health.webhookUrl}</code> · subscribe to the <code className="rounded bg-panel px-1.5 py-0.5 text-ink">messages</code> field.
          </p>
        </div>
      )}
    </section>
  );
}
