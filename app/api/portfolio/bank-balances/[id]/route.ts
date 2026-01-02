import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/core/types";
import { bankBalances } from "@/core/dataStore";
import { loadFromJson, updateInJson, deleteFromJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<BankBalance>("bankBalances");
    bankBalances.splice(0, bankBalances.length, ...jsonData);
    
    const id = params.id;
    const updated: BankBalance = await request.json();
    const result = updateInJson<BankBalance>("bankBalances", id, updated);

    if (!result) {
      return NextResponse.json(
        { error: "Bank balance not found" },
        { status: 404 }
      );
    }

    const index = bankBalances.findIndex((b) => b.id === id);
    if (index !== -1) {
      bankBalances[index] = result;
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
    initializeStorage();
    const jsonData = loadFromJson<BankBalance>("bankBalances");
    bankBalances.splice(0, bankBalances.length, ...jsonData);
    
    const id = params.id;
    const deleted = deleteFromJson<BankBalance>("bankBalances", id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Bank balance not found" },
        { status: 404 }
      );
    }

    const index = bankBalances.findIndex((b) => b.id === id);
    if (index !== -1) {
      bankBalances.splice(index, 1);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete bank balance" },
      { status: 500 }
    );
  }
}

