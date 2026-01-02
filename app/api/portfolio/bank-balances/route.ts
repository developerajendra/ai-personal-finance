import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { bankBalances } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<BankBalance>("bankBalances");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(bb => ({
      ...bb,
      isPublished: bb.isPublished ?? false
    }));
    bankBalances.splice(0, bankBalances.length, ...normalizedData);
    
    // Check for pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    
    // Filter by isPublished if specified
    let filteredData = bankBalances;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = bankBalances.filter(bb => (bb.isPublished ?? false) === isPublished);
    }

    // If pagination requested, return paginated results
    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<BankBalance>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

    // Otherwise return all (for small datasets)
    return NextResponse.json(filteredData);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch bank balances" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<BankBalance>("bankBalances");
    // Ensure isPublished field exists (default to false for backward compatibility)
    const normalizedData = jsonData.map(bb => ({
      ...bb,
      isPublished: bb.isPublished ?? false
    }));
    bankBalances.splice(0, bankBalances.length, ...normalizedData);
    
    const bankBalance: BankBalance = await request.json();
    // Ensure isPublished is set (default to true for manually created items)
    const bankBalanceToAdd = { ...bankBalance, isPublished: bankBalance.isPublished ?? true };
    bankBalances.push(bankBalanceToAdd);
    saveToJson("bankBalances", bankBalances);
    
    return NextResponse.json(bankBalanceToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create bank balance" },
      { status: 500 }
    );
  }
}

