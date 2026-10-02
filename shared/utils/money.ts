/**
 * Monetary helpers. Amounts are stored as REAL rupee values for backward
 * compatibility, so every write is normalised to whole paise and every
 * aggregate is summed in integer paise to avoid floating-point drift
 * (0.1 + 0.2 !== 0.3).
 */

export function toPaise(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Invalid monetary amount: ${amount}`);
  // Math.round is asymmetric for negatives; round the magnitude instead.
  // toPrecision(15) strips binary representation noise (1.005 * 100 = 100.49999…).
  const sign = amount < 0 ? -1 : 1;
  const paise = Math.round(parseFloat((Math.abs(amount) * 100).toPrecision(15)));
  return paise === 0 ? 0 : sign * paise;
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** Normalise an amount to two decimal places (paise precision). */
export function toMoney(amount: number): number {
  return fromPaise(toPaise(amount));
}

export function sumMoney(amounts: Iterable<number | null | undefined>): number {
  let total = 0;
  for (const a of amounts) {
    if (a === null || a === undefined || !Number.isFinite(a)) continue;
    total += toPaise(a);
  }
  return fromPaise(total);
}
