import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { listTransactions, createTransaction } from "@/server/finance/transactions/service";
import type { Transaction } from "@/shared/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    const transactions = await listTransactions(session.userId, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      category: params.get("category") ?? undefined,
      type: type === "debit" || type === "credit" ? (type as Transaction["type"]) : undefined,
    });
    return NextResponse.json(transactions);
  } catch (error) {
    return errorResponse(error, "Failed to fetch transactions");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    // Manual entries via the API are tagged as such regardless of the payload.
    const transaction = await createTransaction(session.userId, { ...body, source: "manual" });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create transaction");
  }
}
