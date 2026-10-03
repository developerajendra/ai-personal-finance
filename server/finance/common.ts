import "server-only";
import { randomUUID } from "crypto";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class FinanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "FinanceError";
  }
}

export class NotFoundError extends FinanceError {
  constructor(entity: string) {
    super(`${entity} not found`, 404, "not_found");
  }
}

export class ValidationError extends FinanceError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "validation_error", details);
  }
}

export class ConflictError extends FinanceError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}

export function parseInput<S extends ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const where = first?.path.length ? `${first.path.join(".")}: ` : "";
      throw new ValidationError(`${where}${first?.message ?? "Invalid input"}`, error.issues);
    }
    throw error;
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/**
 * Validation maps "" / null to undefined so optional fields can be omitted,
 * but on an update an explicit "" or null means "clear this field". Returns
 * `{ field: null }` for each clearable field the caller explicitly blanked.
 */
export function clearedFields(raw: unknown, clearable: readonly string[]): Record<string, null> {
  const out: Record<string, null> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of clearable) {
    if (key in raw) {
      const value = (raw as Record<string, unknown>)[key];
      if (value === null || value === "") out[key] = null;
    }
  }
  return out;
}

export type SourceIdentity = { source: string; sourceRef: string };
