"use client";

import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle, Loader2, Trash2 } from "lucide-react";

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

  const load = async () => {
    const res = await fetch("/api/integrations/whatsapp/link");
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => {
    load();
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
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">WhatsApp</h2>
        </div>
        {status?.status === "verified" && (
          <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle className="w-4 h-4" /> Linked +{status.phoneNumber}
          </span>
        )}
      </div>
      <p className="text-gray-600 text-sm mb-4">
        Link your WhatsApp number to log expenses, add investments and ask questions by message.
      </p>

      {status?.status !== "verified" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number (with country code)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            placeholder="+91 98765 43210"
          />
        </div>
      )}

      {pendingCode && status?.status === "pending" && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          <div className="font-mono text-lg font-semibold mb-1">LINK {pendingCode.code}</div>
          {pendingCode.instructions}
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        {status?.status !== "verified" && (
          <button
            onClick={startLink}
            disabled={busy || phone.trim().length < 8}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {status?.status === "pending" ? "Get a new code" : "Get link code"}
          </button>
        )}
        {status && status.status !== "none" && (
          <button
            onClick={unlink}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Unlink
          </button>
        )}
      </div>
    </section>
  );
}
