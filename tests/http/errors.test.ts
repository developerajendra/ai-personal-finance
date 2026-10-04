import { describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/server/http/errors";
import { ValidationError } from "@/server/finance/common";

describe("errorResponse", () => {
  it("passes finance errors through with their status", async () => {
    const res = errorResponse(new ValidationError("Enter an amount above 0."), "Failed");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Enter an amount above 0.");
  });

  it("says a migration is pending when a table is missing, even when wrapped", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const libsql = new Error("SQLITE_ERROR: no such table: budget_items");
    const wrapped = new Error("Failed query: insert into budget_items …", { cause: libsql });
    const res = errorResponse(wrapped, "Failed to create budget item");
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("SCHEMA_OUT_OF_DATE");
    expect(body.error).toMatch(/^Failed to create budget item: .*db:migrate/);
  });

  it("keeps other unexpected errors generic", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("connection reset"), "Failed to create budget item");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to create budget item");
  });
});
