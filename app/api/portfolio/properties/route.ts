import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const jsonData = await loadFromJson<Property>("properties", userId);
    const normalizedData = jsonData.map(prop => ({
      ...prop,
      isPublished: prop.isPublished ?? false
    }));

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    let filteredData = normalizedData;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = normalizedData.filter(p => (p.isPublished ?? false) === isPublished);
    }

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Property>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

    return NextResponse.json(filteredData);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch properties" },
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
    const jsonData = await loadFromJson<Property>("properties", userId);
    const normalizedData = jsonData.map(prop => ({
      ...prop,
      isPublished: prop.isPublished ?? false
    }));

    const property: Property = await request.json();
    const propertyToAdd = { ...property, isPublished: property.isPublished ?? true };
    const updatedData = [...normalizedData, propertyToAdd];
    await saveToJson("properties", updatedData, userId);

    return NextResponse.json(propertyToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}
