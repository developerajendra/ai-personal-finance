import { NextRequest, NextResponse } from "next/server";
import { Investment } from "@/core/types";
import { investments } from "@/core/dataStore";
import { loadFromJson, updateInJson, deleteFromJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Investment>("investments");
    investments.splice(0, investments.length, ...jsonData);
    
    const investment: Investment = await request.json();
    const updated = updateInJson<Investment>("investments", params.id, investment);

    if (!updated) {
      return NextResponse.json(
        { error: "Investment not found" },
        { status: 404 }
      );
    }

    // Update in-memory store
    const index = investments.findIndex((inv) => inv.id === params.id);
    if (index !== -1) {
      investments[index] = updated;
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update investment" },
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
    const jsonData = loadFromJson<Investment>("investments");
    investments.splice(0, investments.length, ...jsonData);
    
    const deleted = deleteFromJson<Investment>("investments", params.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Investment not found" },
        { status: 404 }
      );
    }

    // Update in-memory store
    const index = investments.findIndex((inv) => inv.id === params.id);
    if (index !== -1) {
      investments.splice(index, 1);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 }
    );
  }
}
