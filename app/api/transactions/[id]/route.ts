import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/core/auth/getSession";
import * as transactionRepo from "@/core/db/repositories/transactionRepository";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const existing = await transactionRepo.findById(session.userId, params.id);
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await transactionRepo.remove(session.userId, params.id);
    const updated = await transactionRepo.create(session.userId, {
      ...existing,
      ...body,
      id: params.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await transactionRepo.findById(session.userId, params.id);
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await transactionRepo.remove(session.userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
