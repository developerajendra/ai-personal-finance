import { NextRequest, NextResponse } from "next/server";
import { Investment } from "@/core/types";
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
    const jsonData = await loadFromJson<Investment>("investments", userId);
    const normalizedData = jsonData.map(inv => ({
      ...inv,
      isPublished: inv.isPublished ?? false
    }));

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    let filteredData = normalizedData;
    if (searchParams.has("isPublished")) {
      const isPublished = searchParams.get("isPublished") === "true";
      filteredData = normalizedData.filter(i => (i.isPublished ?? false) === isPublished);
    }

    if (searchParams.get("view") === "matured") {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((i) => {
        if (!(i.isPublished ?? false)) return false;
        if (i.status === "closed") return true;
        if (i.status === "matured") return true;
        if (i.maturityDate) {
          const maturity = new Date(i.maturityDate);
          return maturity.getTime() <= today.getTime();
        }
        return false;
      });
    } else if (searchParams.get("isPublished") === "true") {
      filteredData = filteredData.filter((i) => i.status !== "closed");
    }

    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const paginated = paginate<Investment>(filteredData, { page, pageSize });
      return NextResponse.json(paginated);
    }

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    initializeStorage();
    const jsonData = await loadFromJson<Investment>("investments", userId);
    const normalizedData = jsonData.map(inv => ({
      ...inv,
      isPublished: inv.isPublished ?? false
    }));

    const investment: Investment = await request.json();
    const investmentToAdd = { ...investment, isPublished: investment.isPublished ?? true };
    const updatedData = [...normalizedData, investmentToAdd];
    await saveToJson("investments", updatedData, userId);

    return NextResponse.json(investmentToAdd, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create investment" },
      { status: 500 }
    );
  }
}
