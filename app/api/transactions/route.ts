import { NextResponse } from "next/server";
import { Transaction } from "@/core/types";

// Mock data - in production, this would come from a database
const mockTransactions: Transaction[] = [];

export async function GET() {
  // In production, fetch from database
  return NextResponse.json(mockTransactions);
}

export async function POST(request: Request) {
  try {
    const transaction: Transaction = await request.json();
    // In production, save to database
    mockTransactions.push(transaction);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

