import { NextRequest, NextResponse } from "next/server";
import { Loan } from "@/shared/types";
import { paginate } from "@/shared/utils/pagination";
import { getSession } from "@/server/auth/session";
import { loanService } from "@/server/finance/loans/service";
import { errorResponse } from "@/server/http/errors";
import { getEffectiveOutstandingAmount } from "@/server/finance/loans/loanAnalytics";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const jsonData = await loanService.list(userId);

    const normalizedData = await Promise.all(
      jsonData.map(async (loan) => ({
        ...loan,
        isPublished: loan.isPublished ?? false,
        outstandingAmount: await getEffectiveOutstandingAmount(userId, loan),
      }))
    );

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

    const body = await request.json();
    const created = await loanService.create(userId, body, { isPublished: body?.isPublished ?? true });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create loan");
  }
}
