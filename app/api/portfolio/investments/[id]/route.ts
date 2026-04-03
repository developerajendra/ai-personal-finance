import { NextRequest, NextResponse } from "next/server";
import { Investment } from "@/core/types";
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
    const investment: Investment = await request.json();
    const updated = updateInJson<Investment>("investments", params.id, investment, userId);

    if (!updated) {
      return NextResponse.json(
        { error: "Investment not found" },
        { status: 404 }
      );
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const deleted = deleteFromJson<Investment>("investments", params.id, userId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Investment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 }
    );
  }
}
