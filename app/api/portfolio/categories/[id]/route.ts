import { NextRequest, NextResponse } from "next/server";
import { PortfolioCategory } from "@/core/types";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, saveToJson, initializeStorage, updateInJson, deleteFromJson } from "@/core/services/jsonStorageService";

export async function GET(
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
    const categories = await loadFromJson<PortfolioCategory>("portfolioCategories", userId);
    const category = categories.find((cat) => cat.id === params.id);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch portfolio category" },
      { status: 500 }
    );
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
    const userId = session.userId;

    initializeStorage();
    const body = await request.json();
    const { name, slug, icon, href, type, description } = body;

    const categories = await loadFromJson<PortfolioCategory>("portfolioCategories", userId);
    const existingCategory = categories.find((cat) => cat.id === params.id);

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (slug && slug !== existingCategory.slug) {
      if (categories.some((cat) => cat.slug === slug && cat.id !== params.id)) {
        return NextResponse.json(
          { error: "A category with this slug already exists" },
          { status: 400 }
        );
      }
    }

    if (type) {
      const validTypes = ["investment", "loan", "property", "bank-balance"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const updates: Partial<PortfolioCategory> = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(icon !== undefined && { icon: icon || undefined }),
      ...(href && { href }),
      ...(type && { type }),
      ...(description !== undefined && { description: description || undefined }),
      updatedAt: new Date().toISOString(),
    };

    const updatedCategory = await updateInJson<PortfolioCategory>(
      "portfolioCategories",
      params.id,
      updates,
      userId
    );

    if (!updatedCategory) {
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update portfolio category" },
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
    const deleted = await deleteFromJson<PortfolioCategory>(
      "portfolioCategories",
      params.id,
      userId
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Category deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete portfolio category" },
      { status: 500 }
    );
  }
}
