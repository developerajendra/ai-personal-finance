import { NextRequest, NextResponse } from "next/server";
import { PortfolioCategory } from "@/core/types";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const categories = await loadFromJson<PortfolioCategory>("portfolioCategories", userId);
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch portfolio categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const body = await request.json();
    const { name, slug, icon, href, type, description } = body;

    if (!name || !slug || !href || !type) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug, href, and type are required" },
        { status: 400 }
      );
    }

    const validTypes = ["investment", "loan", "property", "bank-balance"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const existingCategories = await loadFromJson<PortfolioCategory>("portfolioCategories", userId);
    if (existingCategories.some((cat) => cat.slug === slug)) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 }
      );
    }

    const newCategory: PortfolioCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      slug,
      icon: icon || undefined,
      href,
      type,
      description: description || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedCategories = [...existingCategories, newCategory];
    await saveToJson("portfolioCategories", updatedCategories, userId);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create portfolio category" },
      { status: 500 }
    );
  }
}
