import { NextRequest, NextResponse } from "next/server";
import { fetchMutualFunds, getMockMutualFunds } from "@/core/services/zerodhaService";
import { loadMutualFunds, saveMutualFunds } from "@/core/services/jsonStorageService";
import { cookies } from "next/headers";
import { getSession } from "@/core/auth/getSession";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true" || searchParams.get("sync") === "true";

    // Get access token from cookie
    const accessToken = cookies().get("zerodha_access_token")?.value || "";

    // Try to load from JSON first (unless refresh is requested)
    if (!refresh) {
      const cachedMutualFunds = await loadMutualFunds(userId);
      if (cachedMutualFunds.length > 0) {
        return NextResponse.json({
          mutualFunds: cachedMutualFunds,
          isAuthenticated: !!accessToken,
          fromCache: true,
          message: accessToken ? "Loaded from cache" : "Not connected to Zerodha. Using cached data."
        });
      }
    }

    // If not authenticated, return mock or cached data
    if (!accessToken) {
      const cachedMutualFunds = await loadMutualFunds(userId);
      if (cachedMutualFunds.length > 0) {
        return NextResponse.json({
          mutualFunds: cachedMutualFunds,
          isAuthenticated: false,
          fromCache: true,
          message: "Not connected to Zerodha. Using cached data."
        });
      }

      // Return mock data if no cache
      const mutualFunds = getMockMutualFunds();
      await saveMutualFunds(userId, mutualFunds); // Save mock data for future use
      return NextResponse.json({
        mutualFunds,
        isAuthenticated: false,
        fromCache: false,
        message: "Not connected to Zerodha. Using mock data."
      });
    }

    // Fetch from API and update cache
    try {
      const mutualFunds = await fetchMutualFunds(accessToken);
      await saveMutualFunds(userId, mutualFunds); // Save to JSON cache
      return NextResponse.json({
        mutualFunds,
        isAuthenticated: true,
        fromCache: false,
        message: refresh ? "Data synced from Zerodha" : "Data loaded from Zerodha"
      });
    } catch (apiError: any) {
      console.error("Error fetching from Zerodha API:", apiError);

      // Fallback to cached data if API fails
      const cachedMutualFunds = await loadMutualFunds(userId);
      if (cachedMutualFunds.length > 0) {
        return NextResponse.json({
          mutualFunds: cachedMutualFunds,
          isAuthenticated: true,
          fromCache: true,
          error: apiError.message,
          message: "API error. Using cached data."
        });
      }

      // Return mock data on error in development
      if (process.env.NODE_ENV === "development") {
        const mutualFunds = getMockMutualFunds();
        await saveMutualFunds(userId, mutualFunds);
        return NextResponse.json({
          mutualFunds,
          isAuthenticated: false,
          fromCache: false,
          error: apiError.message
        });
      }

      throw apiError;
    }
  } catch (error: any) {
    console.error("Error in mutual funds route:", error);

    // Last resort: try to return cached data
    const cachedMutualFunds = await loadMutualFunds(userId);
    if (cachedMutualFunds.length > 0) {
      return NextResponse.json({
        mutualFunds: cachedMutualFunds,
        isAuthenticated: false,
        fromCache: true,
        error: error.message,
        message: "Error occurred. Using cached data."
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch mutual funds" },
      { status: 500 }
    );
  }
}
