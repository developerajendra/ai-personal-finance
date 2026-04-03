import { NextRequest, NextResponse } from "next/server";
import { Loan } from "@/core/types";
import { paginate, PaginationParams } from "@/core/services/scalabilityService";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";
import { getEffectiveOutstandingAmount } from "@/core/services/loanAnalyticsService";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans", userId);
    const normalizedData = jsonData.map((loan) => ({
      ...loan,
      isPublished: loan.isPublished ?? false,
      outstandingAmount: getEffectiveOutstandingAmount(userId, loan),
    }));

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    let filteredData = normalizedData;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = normalizedData.filter((l) => (l.isPublished ?? false) === isPublished);
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const jsonData = loadFromJson<Loan>("loans", userId);
    const normalizedData = jsonData.map(loan => ({
      ...loan,
      isPublished: loan.isPublished ?? false
    }));
    
    const loan: Loan = await request.json();
    const loanToAdd = { ...loan, isPublished: loan.isPublished ?? true };
    const updatedData = [...normalizedData, loanToAdd];
    saveToJson("loans", updatedData, userId);
    
    return NextResponse.json(loanToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}
