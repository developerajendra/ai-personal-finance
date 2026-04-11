import { NextResponse } from "next/server";
import { Transaction } from "@/core/types";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, appendToJson, initializeStorage } from "@/core/services/jsonStorageService";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initializeStorage();
    const transactions = await loadFromJson<Transaction>("transactions", session.userId);
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const newTransaction: Transaction = {
      ...body,
      id: body.id || randomUUID(),
    };

    initializeStorage();
    await appendToJson<Transaction>("transactions", [newTransaction], session.userId);

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
