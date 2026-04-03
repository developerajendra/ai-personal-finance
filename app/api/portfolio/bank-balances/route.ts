import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/core/types";
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
    const jsonData = await loadFromJson<BankBalance>("bankBalances", userId);
    const normalizedData = jsonData.map(bb => ({
      ...bb,
      isPublished: bb.isPublished ?? false
    }));

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    let filteredData = normalizedData;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = normalizedData.filter(bb => (bb.isPublished ?? false) === isPublished);
    }

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<BankBalance>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const jsonData = await loadFromJson<BankBalance>("bankBalances", userId);
    const normalizedData = jsonData.map(bb => ({
      ...bb,
      isPublished: bb.isPublished ?? false
    }));

    const bankBalance: BankBalance = await request.json();
    const bankBalanceToAdd = { ...bankBalance, isPublished: bankBalance.isPublished ?? true };
    const updatedData = [...normalizedData, bankBalanceToAdd];
    await saveToJson("bankBalances", updatedData, userId);

    return NextResponse.json(bankBalanceToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create bank balance" },
      { status: 500 }
    );
  }
}
