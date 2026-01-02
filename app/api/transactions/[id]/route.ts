import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@/core/types";

// Mock storage - in production, use database
const transactions: Transaction[] = [];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transaction: Transaction = await request.json();
    const index = transactions.findIndex((t) => t.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    transactions[index] = { ...transaction, id: params.id };
    return NextResponse.json(transactions[index]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const index = transactions.findIndex((t) => t.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    transactions.splice(index, 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}

