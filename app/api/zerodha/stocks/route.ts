import { NextRequest, NextResponse } from "next/server";
import { fetchStocks, getMockStocks } from "@/core/services/zerodhaService";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = cookies().get("zerodha_access_token")?.value || "";

    if (!accessToken) {
      // Return mock data if not authenticated
      const stocks = getMockStocks();
      return NextResponse.json({ 
        stocks, 
        isAuthenticated: false,
        message: "Not connected to Zerodha. Using mock data." 
      });
    }

    const stocks = await fetchStocks(accessToken);
    return NextResponse.json({ 
      stocks, 
      isAuthenticated: true 
    });
  } catch (error: any) {
    console.error("Error fetching stocks:", error);
    // Return mock data on error in development
    if (process.env.NODE_ENV === "development") {
      const stocks = getMockStocks();
      return NextResponse.json({ 
        stocks, 
        isAuthenticated: false,
        error: error.message 
      });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch stocks" },
      { status: 500 }
    );
  }
}

