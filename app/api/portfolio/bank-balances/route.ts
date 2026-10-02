import { NextRequest, NextResponse } from "next/server";
import { BankBalance } from "@/shared/types";
import { paginate } from "@/shared/utils/pagination";
import { getSession } from "@/server/auth/session";
import { bankBalanceService } from "@/server/finance/accounts/service";
import { errorResponse } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const jsonData = await bankBalanceService.list(userId);
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

    const body = await request.json();
    const created = await bankBalanceService.create(userId, body, { isPublished: body?.isPublished ?? true });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create bank balance");
  }
}
