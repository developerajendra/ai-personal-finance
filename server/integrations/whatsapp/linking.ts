import "server-only";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/server/db/client";
import * as waRepo from "@/server/db/repositories/whatsappRepository";
import { ConflictError, ValidationError } from "@/server/finance/common";
import { normalizePhone } from "./webhook";

/**
 * Linking proves the signed-in user controls the WhatsApp number:
 *  1. In the app (authenticated) the user enters their number → we issue a
 *     short-lived one-time code bound to (user, number).
 *  2. The user sends "LINK <code>" from that number. Meta's signed webhook
 *     tells us which number sent it, so a match verifies possession.
 * Codes are stored hashed, expire, and lock after repeated wrong guesses.
 */

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_MAX_ATTEMPTS = 5;
const LINK_COMMAND = /^\s*link\s+(\d{6})\s*$/i;

function hashCode(linkId: string, code: string): string {
  return createHash("sha256").update(`${linkId}:${code}`).digest("hex");
}

export interface LinkStatus {
  status: "none" | "pending" | "verified";
  phoneNumber?: string;
  verifiedAt?: string | null;
  codeExpiresAt?: string | null;
}

export async function getLinkStatus(userId: string): Promise<LinkStatus> {
  const link = await waRepo.findLinkByUser(userId);
  if (!link || link.status === "revoked") return { status: "none" };
  return {
    status: link.status as LinkStatus["status"],
    phoneNumber: link.phoneNumber,
    verifiedAt: link.verifiedAt,
    codeExpiresAt: link.status === "pending" ? link.codeExpiresAt : null,
  };
}

export async function startLink(userId: string, rawPhone: string, now = new Date()): Promise<{ code: string; expiresAt: string; phoneNumber: string }> {
  const phone = normalizePhone(rawPhone ?? "");
  if (phone.length < 8 || phone.length > 15) {
    throw new ValidationError("Enter the WhatsApp number with country code, e.g. +91 98765 43210");
  }

  const holder = await waRepo.findLinkByPhone(phone);
  if (holder && holder.userId !== userId) {
    const stalePending =
      holder.status !== "verified" && (!holder.codeExpiresAt || new Date(holder.codeExpiresAt) <= now);
    if (!stalePending) throw new ConflictError("This WhatsApp number is already linked to another account");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString();
  const id = crypto.randomUUID();

  // Replace this user's previous link (and any stale claim on the number).
  await db.transaction(async (tx) => {
    const existing = await waRepo.findLinkByUser(userId, tx);
    if (existing) await waRepo.deleteLink(existing.id, tx);
    const claimant = await waRepo.findLinkByPhone(phone, tx);
    if (claimant && claimant.userId !== userId) await waRepo.deleteLink(claimant.id, tx);
    await waRepo.insertLink(
      {
        id,
        userId,
        phoneNumber: phone,
        status: "pending",
        codeHash: hashCode(id, code),
        codeExpiresAt: expiresAt,
        verifyAttempts: 0,
      },
      tx
    );
  });
  return { code, expiresAt, phoneNumber: phone };
}

export async function unlink(userId: string): Promise<void> {
  const link = await waRepo.findLinkByUser(userId);
  if (link) await waRepo.deleteLink(link.id);
}

/** Returns the userId for a verified number, or null. */
export async function resolveVerifiedUser(phone: string): Promise<string | null> {
  const link = await waRepo.findLinkByPhone(phone);
  return link && link.status === "verified" ? link.userId : null;
}

export type LinkAttempt =
  | { handled: false }
  | { handled: true; ok: true; userId: string; reply: string }
  | { handled: true; ok: false; reply: string };

/** Handle a "LINK 123456" message from an unverified number. */
export async function tryVerifyLink(phone: string, text: string | null, now = new Date()): Promise<LinkAttempt> {
  const match = text?.match(LINK_COMMAND);
  if (!match) return { handled: false };
  const failure: LinkAttempt = {
    handled: true,
    ok: false,
    reply: "That code didn't match or has expired. Open Settings → WhatsApp in the app to get a new code.",
  };

  const link = await waRepo.findLinkByPhone(phone);
  if (!link || link.status !== "pending" || !link.codeHash || !link.codeExpiresAt) return failure;
  if (new Date(link.codeExpiresAt) <= now || link.verifyAttempts >= LINK_MAX_ATTEMPTS) return failure;

  const expected = Buffer.from(link.codeHash, "hex");
  const actual = Buffer.from(hashCode(link.id, match[1]), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await waRepo.updateLink(link.id, { verifyAttempts: link.verifyAttempts + 1 });
    return failure;
  }

  await waRepo.updateLink(link.id, {
    status: "verified",
    verifiedAt: now.toISOString(),
    codeHash: null,
    codeExpiresAt: null,
  });
  return {
    handled: true,
    ok: true,
    userId: link.userId,
    reply:
      "✅ Your WhatsApp number is now linked. You can log expenses (\"spent 450 on lunch\"), add investments (\"FD of 50000 at 7.1%\") or ask about your finances.",
  };
}
