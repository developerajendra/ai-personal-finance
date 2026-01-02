import { NextRequest, NextResponse } from "next/server";
import { Loan } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { loans } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(loan => ({
      ...loan,
      isPublished: loan.isPublished ?? false
    }));
    loans.splice(0, loans.length, ...normalizedData);
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    
    // Filter by isPublished if specified
    let filteredData = loans;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = loans.filter(l => (l.isPublished ?? false) === isPublished);
    }

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Loan>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

    return NextResponse.json(filteredData);
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
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(loan => ({
      ...loan,
      isPublished: loan.isPublished ?? false
    }));
    loans.splice(0, loans.length, ...normalizedData);
    
    const loan: Loan = await request.json();
    // Ensure isPublished is set (default to true for manually created items)
    const loanToAdd = { ...loan, isPublished: loan.isPublished ?? true };
    loans.push(loanToAdd);
    saveToJson("loans", loans);
    
    return NextResponse.json(loanToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}

