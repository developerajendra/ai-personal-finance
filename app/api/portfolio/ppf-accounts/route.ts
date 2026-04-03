import { NextResponse } from "next/server";
import { loadPPFAccounts } from "@/core/services/ppfStorageService";
import { getSession } from "@/core/auth/getSession";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const accounts = loadPPFAccounts(userId);
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching PPF accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch PPF accounts" },
      { status: 500 }
    );
  }
}
