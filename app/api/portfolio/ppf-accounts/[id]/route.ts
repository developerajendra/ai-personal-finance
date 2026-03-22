import { NextRequest, NextResponse } from "next/server";
import {
  loadPPFAccounts,
  savePPFAccount,
  PPFAccount,
} from "@/core/services/ppfStorageService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accounts = loadPPFAccounts();
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

    savePPFAccount(updatedAccount);
    const saved = loadPPFAccounts().find((acc) => acc.id === params.id);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Error updating PPF account:", error);
    return NextResponse.json(
      { error: "Failed to update PPF account" },
      { status: 500 }
    );
  }
}
