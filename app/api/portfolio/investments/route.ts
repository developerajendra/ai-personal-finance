import { NextRequest, NextResponse } from "next/server";
import { Investment } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { investments } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    // Initialize and load from JSON
    initializeStorage();
    const jsonData = loadFromJson<Investment>("investments");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(inv => ({
      ...inv,
      isPublished: inv.isPublished ?? false
    }));
    investments.splice(0, investments.length, ...normalizedData);
    
    // Check for pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    
    // Filter by isPublished if specified
    let filteredData = investments;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = investments.filter(i => (i.isPublished ?? false) === isPublished);
    }

    // If pagination requested, return paginated results
    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Investment>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

    // Otherwise return all (for small datasets)
    return NextResponse.json(filteredData);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch investments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Investment>("investments");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(inv => ({
      ...inv,
      isPublished: inv.isPublished ?? false
    }));
    investments.splice(0, investments.length, ...normalizedData);
    
    const investment: Investment = await request.json();
    // Ensure isPublished is set (default to true for manually created items)
    const investmentToAdd = { ...investment, isPublished: investment.isPublished ?? true };
    investments.push(investmentToAdd);
    saveToJson("investments", investments);
    
    return NextResponse.json(investmentToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create investment" },
      { status: 500 }
    );
  }
}

