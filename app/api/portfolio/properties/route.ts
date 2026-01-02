import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { properties } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    properties.splice(0, properties.length, ...jsonData);
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Property>(properties, { page, pageSize });
      return NextResponse.json(paginated);
    }

    return NextResponse.json(properties);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    properties.splice(0, properties.length, ...jsonData);
    
    const property: Property = await request.json();
    properties.push(property);
    saveToJson("properties", properties);
    
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}

