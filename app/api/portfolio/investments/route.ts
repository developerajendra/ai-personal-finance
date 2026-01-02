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
    investments.splice(0, investments.length, ...jsonData);
    
    // Check for pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    // If pagination requested, return paginated results
    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Investment>(investments, { page, pageSize });
      return NextResponse.json(paginated);
    }

    // Otherwise return all (for small datasets)
    return NextResponse.json(investments);
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
    investments.splice(0, investments.length, ...jsonData);
    
    const investment: Investment = await request.json();
    investments.push(investment);
    saveToJson("investments", investments);
    
    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create investment" },
      { status: 500 }
    );
  }
}

