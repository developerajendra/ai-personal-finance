import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { getCategory, updateCategory, deleteCategory } from "@/server/finance/portfolio/categoryService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const category = await getCategory(session.userId, params.id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error) {
    return errorResponse(error, "Failed to fetch portfolio category");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const updated = await updateCategory(session.userId, params.id, await request.json());
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "Failed to update portfolio category");
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
    await deleteCategory(session.userId, params.id);
    return NextResponse.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    return errorResponse(error, "Failed to delete portfolio category");
  }
}
