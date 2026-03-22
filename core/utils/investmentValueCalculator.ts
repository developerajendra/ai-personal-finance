/**
 * Shared investment value calculation.
 * Used by Dashboard (usePortfolioData), Archive snapshot, and PortfolioGrid
 * to ensure consistent values across the app.
 */

import { convertToINR } from "@/core/services/currencyService";
import type { Currency } from "@/core/services/currencyService";
import type { Investment } from "@/core/types";

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

/**
 * Get investment value in INR at a given date.
 * Uses ruleFormula when available, otherwise principal.
 */
export function getInvestmentValueAtDate(
  inv: Investment,
  asOfDate: Date
): number {
  const currency = (inv.originalCurrency || inv.currency || "INR") as Currency;
  const principal = inv.originalAmount ?? inv.amount ?? 0;
  const principalInr = convertToINR(principal, currency);

  if (inv.ruleFormula && inv.startDate) {
    const calculated = evaluateFormula(
      principalInr,
      inv.ruleFormula,
      asOfDate,
      inv.startDate
    );
    if (calculated !== null) return calculated;
  }
  return principalInr;
}

/**
 * Get current investment value (as of now).
 */
export function getCurrentInvestmentValue(inv: Investment): number {
  return getInvestmentValueAtDate(inv, new Date());
}
