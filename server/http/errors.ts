import "server-only";
import { NextResponse } from "next/server";
import { FinanceError } from "@/server/finance/common";

/**
 * Map service errors to HTTP responses. Validation and not-found messages are
 * safe to show; anything unexpected is logged and reported generically.
 */
export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof FinanceError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status }
    );
  }
  console.error(`[API] ${fallbackMessage}:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
