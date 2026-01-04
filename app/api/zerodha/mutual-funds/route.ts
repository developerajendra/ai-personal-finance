import { NextRequest, NextResponse } from "next/server";
import { fetchMutualFunds, getMockMutualFunds } from "@/core/services/zerodhaService";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = cookies().get("zerodha_access_token")?.value || "";

    if (!accessToken) {
      // Return mock data if not authenticated
      const mutualFunds = getMockMutualFunds();
      return NextResponse.json({ 
        mutualFunds, 
        isAuthenticated: false,
        message: "Not connected to Zerodha. Using mock data." 
      });
    }

    const mutualFunds = await fetchMutualFunds(accessToken);
    return NextResponse.json({ 
      mutualFunds, 
      isAuthenticated: true 
    });
  } catch (error: any) {
    console.error("Error fetching mutual funds:", error);
    // Return mock data on error in development
    if (process.env.NODE_ENV === "development") {
      const mutualFunds = getMockMutualFunds();
      return NextResponse.json({ 
        mutualFunds, 
        isAuthenticated: false,
        error: error.message 
      });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch mutual funds" },
      { status: 500 }
    );
  }
}

