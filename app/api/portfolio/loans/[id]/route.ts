import { NextRequest, NextResponse } from "next/server";
import { Loan } from "@/core/types";
import { loans } from "@/core/dataStore";
import { loadFromJson, updateInJson, deleteFromJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans");
    loans.splice(0, loans.length, ...jsonData);
    
    const loan: Loan = await request.json();
    const updated = updateInJson<Loan>("loans", params.id, loan);

    if (!updated) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    const index = loans.findIndex((l) => l.id === params.id);
    if (index !== -1) {
      loans[index] = updated;
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update loan" },
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
    const jsonData = loadFromJson<Loan>("loans");
    loans.splice(0, loans.length, ...jsonData);
    
    const deleted = deleteFromJson<Loan>("loans", params.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    const index = loans.findIndex((loan) => loan.id === params.id);
    if (index !== -1) {
      loans.splice(index, 1);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500 }
    );
  }
}
