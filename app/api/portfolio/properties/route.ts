import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { properties } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(prop => ({
      ...prop,
      isPublished: prop.isPublished ?? false
    }));
    properties.splice(0, properties.length, ...normalizedData);
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    
    // Filter by isPublished if specified
    let filteredData = properties;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = properties.filter(p => (p.isPublished ?? false) === isPublished);
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
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(prop => ({
      ...prop,
      isPublished: prop.isPublished ?? false
    }));
    properties.splice(0, properties.length, ...normalizedData);
    
    const property: Property = await request.json();
    // Ensure isPublished is set (default to true for manually created items)
    const propertyToAdd = { ...property, isPublished: property.isPublished ?? true };
    properties.push(propertyToAdd);
    saveToJson("properties", properties);
    
    return NextResponse.json(propertyToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}

