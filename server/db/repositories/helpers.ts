import "server-only";

/** Rows per multi-row INSERT; keeps well under SQLite's bound-parameter limit. */
export const INSERT_CHUNK_SIZE = 50;

export function chunk<T>(items: T[], size = INSERT_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Drop keys whose value is `undefined` so partial updates never null out columns. */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function isUniqueConstraintError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; cause?: { code?: string; message?: string } } | undefined;
  const text = `${e?.code ?? ""} ${e?.message ?? ""} ${e?.cause?.code ?? ""} ${e?.cause?.message ?? ""}`;
  return /SQLITE_CONSTRAINT|UNIQUE constraint failed/i.test(text);
}
