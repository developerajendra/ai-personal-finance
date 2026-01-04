import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCode } from "@/core/services/zerodhaService";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestToken = searchParams.get("request_token");
    const status = searchParams.get("status");

    if (status === "success" && requestToken) {
      // Exchange request token for access token
      const accessToken = await exchangeAuthCode(requestToken);
      
      // Store access token in httpOnly cookie (secure)
      cookies().set("zerodha_access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      // Redirect to portfolio page
      return NextResponse.redirect(new URL("/admin/portfolio/stocks", request.url));
    } else {
      // Authentication failed
      return NextResponse.redirect(
        new URL("/admin/portfolio?error=auth_failed", request.url)
      );
    }
  } catch (error: any) {
    console.error("Error in Zerodha callback:", error);
    return NextResponse.redirect(
      new URL("/admin/portfolio?error=callback_error", request.url)
    );
  }
}

