import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/core/types";
import { getSession } from "@/core/auth/getSession";
import { updateInJson, deleteFromJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const id = params.id;
    const updated: BankBalance = await request.json();
    const result = updateInJson<BankBalance>("bankBalances", id, updated, userId);

    if (!result) {
      return NextResponse.json(
        { error: "Bank balance not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update bank balance" },
      { status: 500 }
    );
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
    const userId = session.userId;

    initializeStorage();
    const id = params.id;
    const deleted = deleteFromJson<BankBalance>("bankBalances", id, userId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Bank balance not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete bank balance" },
      { status: 500 }
    );
  }
}
