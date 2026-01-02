import { NextRequest, NextResponse } from "next/server";
import { Loan } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { loans } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans");
    loans.splice(0, loans.length, ...jsonData);
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Loan>(loans, { page, pageSize });
      return NextResponse.json(paginated);
    }

    return NextResponse.json(loans);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans");
    loans.splice(0, loans.length, ...jsonData);
    
    const loan: Loan = await request.json();
    loans.push(loan);
    saveToJson("loans", loans);
    
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}

