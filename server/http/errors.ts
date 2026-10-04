import "server-only";
import { NextResponse } from "next/server";
import { FinanceError } from "@/server/finance/common";

/** True when the database is behind the code: a table or column from an unapplied migration. */
function isMissingSchema(error: unknown): boolean {
  // Drizzle wraps the libsql error, so walk the cause chain
  for (let e: unknown = error, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const message = e instanceof Error ? e.message : String(e);
    if (/no such (table|column)/i.test(message)) return true;
  }
  return false;
}

/**
 * Map service errors to HTTP responses. Validation and not-found messages are
 * safe to show; a schema that is missing a migration says so; anything else
 * unexpected is logged and reported generically.
 */
export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof FinanceError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status }
    );
  }
  console.error(`[API] ${fallbackMessage}:`, error);
  if (isMissingSchema(error)) {
    return NextResponse.json(
      {
        error: `${fallbackMessage}: the database is missing a recent update. Apply the pending migrations (npm run db:migrate — see docs/production-migrations.md) and try again.`,
        code: "SCHEMA_OUT_OF_DATE",
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
