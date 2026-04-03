import { NextRequest, NextResponse } from "next/server";
import {
  loadPPFAccounts,
  savePPFAccount,
  PPFAccount,
} from "@/core/services/ppfStorageService";
import { getSession } from "@/core/auth/getSession";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const accounts = await loadPPFAccounts(userId);
    const existing = accounts.find((acc) => acc.id === params.id);

    if (!existing) {
      return NextResponse.json(
        { error: "PPF account not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updatedAccount: PPFAccount = {
      ...existing,
      ...body,
      id: params.id,
      extractedAt: existing.extractedAt,
      extractedFrom: body.extractedFrom ?? existing.extractedFrom,
      rawData: body.rawData ?? existing.rawData,
    };

    await savePPFAccount(userId, updatedAccount);
    const savedAccounts = await loadPPFAccounts(userId);
    const saved = savedAccounts.find((acc) => acc.id === params.id);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Error updating PPF account:", error);
    return NextResponse.json(
      { error: "Failed to update PPF account" },
      { status: 500 }
    );
  }
}
