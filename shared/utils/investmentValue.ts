/**
 * Shared investment value calculation.
 * Used by Dashboard (usePortfolioData), Archive snapshot, and PortfolioGrid
 * to ensure consistent values across the app.
 */

import { convertToINR } from "@/shared/utils/currency";
import type { Currency } from "@/shared/utils/currency";
import type { Investment } from "@/shared/types";

const DANGEROUS_PATTERNS = [
  /eval\s*\(/i,
  /function\s*\(/i,
  /require\s*\(/i,
  /import\s+/i,
  /process\./i,
  /global\./i,
  /window\./i,
  /document\./i,
];

function evaluateFormula(
  principal: number,
  ruleFormula: string,
  targetDate: Date,
  startDate: string
): number | null {
  if (!ruleFormula?.trim() || !startDate) return null;
  if (DANGEROUS_PATTERNS.some((p) => p.test(ruleFormula))) return null;

  try {
    const start = new Date(startDate);
    const daysElapsed = Math.max(
      0,
      Math.floor((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const yearsElapsed = daysElapsed / 365;
    const monthsElapsed = daysElapsed / 30;

    const context = {
      principal,
      amount: principal,
      daysElapsed,
      yearsElapsed,
      monthsElapsed,
      Math: {
        pow: Math.pow,
        exp: Math.exp,
        log: Math.log,
        sqrt: Math.sqrt,
        abs: Math.abs,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        min: Math.min,
        max: Math.max,
        PI: Math.PI,
        E: Math.E,
      },
    };

    const func = new Function(
      ...Object.keys(context),
      `return ${ruleFormula}`
    );
    const result = func(...Object.values(context));
    if (typeof result !== "number" || !isFinite(result) || isNaN(result))
      return null;
    return result;
  } catch {
    return null;
  }
}

export const DEFAULT_COMPOUNDING_MONTHS = 3;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Compound interest: principal × (1 + r/n)^(n·t), with n compounding periods a year
 * and t the years from start to `asOf`, capped at the maturity date when given.
 */
export function compoundValue(
  principal: number,
  annualRatePct: number,
  startDate: string,
  asOf: Date,
  maturityDate?: string,
  compoundingMonths: number = DEFAULT_COMPOUNDING_MONTHS
): number {
  const start = new Date(startDate);
  let end = asOf;
  if (maturityDate) {
    const maturity = new Date(maturityDate);
    if (!Number.isNaN(maturity.getTime()) && maturity < end) end = maturity;
  }
  const years = Math.max(0, (end.getTime() - start.getTime()) / MS_PER_YEAR);
  if (!years || !annualRatePct || Number.isNaN(years)) return principal;
  const periodsPerYear = 12 / Math.max(1, compoundingMonths);
  return principal * Math.pow(1 + annualRatePct / 100 / periodsPerYear, periodsPerYear * years);
}

function principalInrOf(inv: Investment): number {
  const currency = (inv.originalCurrency || inv.currency || "INR") as Currency;
  return convertToINR(inv.originalAmount ?? inv.amount ?? 0, currency);
}

/**
 * FD value without a growth rule: compound the interest rate, or — when only a
 * maturity amount was recorded — grow steadily from principal to that amount.
 */
function fdValueAtDate(inv: Investment, principalInr: number, asOfDate: Date): number | null {
  if (inv.type !== "fd" || !inv.startDate) return null;
  if (inv.interestRate && inv.interestRate > 0) {
    return compoundValue(principalInr, inv.interestRate, inv.startDate, asOfDate, inv.maturityDate, inv.compoundingMonths);
  }
  if (inv.maturityDate && inv.maturityAmount && principalInr > 0 && inv.maturityAmount > principalInr) {
    const start = new Date(inv.startDate).getTime();
    const term = new Date(inv.maturityDate).getTime() - start;
    if (!(term > 0)) return null;
    const progress = Math.min(1, Math.max(0, (asOfDate.getTime() - start) / term));
    return principalInr * Math.pow(inv.maturityAmount / principalInr, progress);
  }
  return null;
}

/**
 * Get investment value in INR at a given date.
 * Uses ruleFormula when available, then FD interest, otherwise principal.
 */
export function getInvestmentValueAtDate(
  inv: Investment,
  asOfDate: Date
): number {
  const principalInr = principalInrOf(inv);

  if (inv.ruleFormula && inv.startDate) {
    const calculated = evaluateFormula(
      principalInr,
      inv.ruleFormula,
      asOfDate,
      inv.startDate
    );
    if (calculated !== null) return calculated;
  }
  return fdValueAtDate(inv, principalInr, asOfDate) ?? principalInr;
}

/**
 * Maturity amount in INR: the recorded figure, else the value at the maturity date
 * (from the growth rule or FD interest). Null when neither is available.
 */
export function getMaturityAmount(inv: Investment): number | null {
  if (inv.maturityAmount != null && inv.maturityAmount > 0) return inv.maturityAmount;
  if (!inv.maturityDate || !inv.startDate) return null;
  const hasGrowth = !!inv.ruleFormula || (inv.type === "fd" && !!inv.interestRate);
  return hasGrowth ? getInvestmentValueAtDate(inv, new Date(inv.maturityDate)) : null;
}

/**
 * Get current investment value (as of now).
 */
export function getCurrentInvestmentValue(inv: Investment): number {
  return getInvestmentValueAtDate(inv, new Date());
}
