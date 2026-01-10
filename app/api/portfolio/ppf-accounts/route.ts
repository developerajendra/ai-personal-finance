import { NextResponse } from "next/server";
import { loadPPFAccounts } from "@/core/services/ppfStorageService";

export async function GET() {
  try {
    const accounts = loadPPFAccounts();
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching PPF accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch PPF accounts" },
      { status: 500 }
    );
  }
}
