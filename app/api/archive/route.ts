import { NextRequest, NextResponse } from "next/server";
import {
  getSnapshot,
  getSnapshotsByYear,
  getAvailableYears,
  getAvailableMonths,
  calculateGrowthMetrics,
  getPreviousSnapshot,
} from "@/core/services/archiveService";
import { getSession } from "@/core/auth/getSession";

// GET: Fetch archive data
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const action = searchParams.get("action") || "list";

    if (action === "years") {
      // Get available years
      const years = getAvailableYears(userId);
      return NextResponse.json({ years });
    }

    if (action === "months" && year) {
      // Get available months for a year
      const months = getAvailableMonths(userId, parseInt(year));
      return NextResponse.json({ months });
    }

    if (year) {
      const yearNum = parseInt(year);
      if (month) {
        // Get specific month snapshot
        const monthNum = parseInt(month);
        const snapshot = getSnapshot(userId, yearNum, monthNum);
        if (!snapshot) {
          return NextResponse.json(
            { error: "Snapshot not found" },
            { status: 404 }
          );
        }

        // Calculate growth metrics
        const previous = getPreviousSnapshot(userId, snapshot);
        const growth = calculateGrowthMetrics(userId, snapshot, previous || undefined);

        return NextResponse.json({
          snapshot,
          growth,
        });
      } else {
        // If no month specified
        // For 2025 and current year, return all monthly snapshots (filter out yearly)
        // For past years, try yearly snapshot first
        if (yearNum >= 2025) {
          // For 2025 and current year, return only monthly snapshots (exclude yearly)
          const allSnapshots = getSnapshotsByYear(userId, yearNum);
          const monthlySnapshots = allSnapshots.filter(s => s.month !== undefined);
          return NextResponse.json({ snapshots: monthlySnapshots });
        } else {
          // For past years, try yearly snapshot first
          const yearlySnapshot = getSnapshot(userId, yearNum);
          if (yearlySnapshot) {
            const previous = getPreviousSnapshot(userId, yearlySnapshot);
            const growth = calculateGrowthMetrics(userId, yearlySnapshot, previous || undefined);
            return NextResponse.json({
              snapshot: yearlySnapshot,
              growth,
            });
          }
          // Get all snapshots for the year
          const snapshots = getSnapshotsByYear(userId, yearNum);
          return NextResponse.json({ snapshots });
        }
      }
    }

    // Get all snapshots
    const years = getAvailableYears(userId);
    return NextResponse.json({ years, message: "Use ?year=YYYY&month=MM to get specific snapshot" });
  } catch (error: any) {
    console.error("Error fetching archive data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch archive data" },
      { status: 500 }
    );
  }
}

