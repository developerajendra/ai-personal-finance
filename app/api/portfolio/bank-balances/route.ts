import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { bankBalances } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function GET(request: NextRequest) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<BankBalance>("bankBalances");
    bankBalances.splice(0, bankBalances.length, ...jsonData);
    
    // Check for pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    // If pagination requested, return paginated results
    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<BankBalance>(bankBalances, { page, pageSize });
      return NextResponse.json(paginated);
    }

    // Otherwise return all (for small datasets)
    return NextResponse.json(bankBalances);
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
    bankBalances.splice(0, bankBalances.length, ...jsonData);
    
    const bankBalance: BankBalance = await request.json();
    bankBalances.push(bankBalance);
    saveToJson("bankBalances", bankBalances);
    
    return NextResponse.json(bankBalance, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create bank balance" },
      { status: 500 }
    );
  }
}

