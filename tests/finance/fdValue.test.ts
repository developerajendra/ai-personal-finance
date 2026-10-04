import { describe, expect, it } from "vitest";
import { compoundValue, getInvestmentValueAtDate, getMaturityAmount } from "@/shared/utils/investmentValue";
import type { Investment } from "@/shared/types";

const fd = (over: Partial<Investment> = {}): Investment => ({
  id: "inv-1",
  name: "Utkarsh SFB",
  amount: 400000,
  currency: "INR",
  type: "fd",
  startDate: "2025-04-23",
  maturityDate: "2028-04-22",
  interestRate: 8.5,
  status: "active",
  isPublished: true,
  createdAt: "2025-04-23",
  updatedAt: "2025-04-23",
  ...over,
});

describe("FD value", () => {
  it("compounds quarterly by default", () => {
    // 4,00,000 at 8.5% for 3 years, quarterly: 400000 × (1 + 0.085/4)^12
    const expected = 400000 * Math.pow(1 + 0.085 / 4, 12);
    expect(getMaturityAmount(fd())).toBeCloseTo(expected, -1);
  });

  it("uses the chosen compounding period", () => {
    const yearly = 400000 * Math.pow(1.085, 3);
    expect(getMaturityAmount(fd({ compoundingMonths: 12 }))).toBeCloseTo(yearly, -1);
  });

  it("grows between start and maturity and stops at maturity", () => {
    const mid = getInvestmentValueAtDate(fd(), new Date("2026-10-23"));
    expect(mid).toBeGreaterThan(400000);
    expect(mid).toBeLessThan(getMaturityAmount(fd())!);
    expect(getInvestmentValueAtDate(fd(), new Date("2031-01-01"))).toBeCloseTo(getMaturityAmount(fd())!, 2);
    expect(getInvestmentValueAtDate(fd(), new Date("2025-01-01"))).toBe(400000);
  });

  it("prefers a recorded maturity amount and grows towards it when there is no rate", () => {
    const noRate = fd({ interestRate: undefined, maturityAmount: 500000 });
    expect(getMaturityAmount(noRate)).toBe(500000);
    const mid = getInvestmentValueAtDate(noRate, new Date("2026-10-23"));
    expect(mid).toBeGreaterThan(400000);
    expect(mid).toBeLessThan(500000);
  });

  it("leaves non-FD investments without a rule at principal", () => {
    expect(getInvestmentValueAtDate(fd({ type: "bonds" }), new Date("2027-01-01"))).toBe(400000);
    expect(compoundValue(1000, 0, "2025-01-01", new Date("2027-01-01"))).toBe(1000);
  });
});
