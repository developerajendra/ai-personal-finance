import { NextRequest, NextResponse } from "next/server";
import { PortfolioCategory } from "@/core/types";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET() {
  try {
    initializeStorage();
    const categories = loadFromJson<PortfolioCategory>("portfolioCategories");
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
    initializeStorage();
    const body = await request.json();
    const { name, slug, icon, href, type, description } = body;

    // Validation
    if (!name || !slug || !href || !type) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug, href, and type are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["investment", "loan", "property", "bank-balance"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingCategories = loadFromJson<PortfolioCategory>("portfolioCategories");
    if (existingCategories.some((cat) => cat.slug === slug)) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 }
      );
    }

    // Create new category
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
    saveToJson("portfolioCategories", updatedCategories);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create portfolio category" },
      { status: 500 }
    );
  }
}
