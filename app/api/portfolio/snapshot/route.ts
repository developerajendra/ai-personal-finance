import { NextResponse } from "next/server";
import { loadFromJson, loadStocks, loadMutualFunds } from "@/core/services/jsonStorageService";
import { loadPPFAccounts } from "@/core/services/ppfStorageService";
import { Investment, Loan, Property, BankBalance } from "@/core/types";

export async function GET() {
  try {
    const [rawInvestments, rawLoans, rawProperties, rawBankBalances] = await Promise.all([
      Promise.resolve(loadFromJson<Investment>("investments")),
      Promise.resolve(loadFromJson<Loan>("loans")),
      Promise.resolve(loadFromJson<Property>("properties")),
      Promise.resolve(loadFromJson<BankBalance>("bankBalances")),
    ]);

    const investments = rawInvestments
      .map((inv) => ({ ...inv, isPublished: inv.isPublished ?? false }))
      .filter((inv) => inv.isPublished);

    const loans = rawLoans.filter((l) => l.isPublished ?? false);
    const properties = rawProperties.filter((p) => p.isPublished ?? false);
    const bankBalances = rawBankBalances.filter((bb) => bb.isPublished ?? false);

    const stocks = loadStocks();
    const mutualFunds = loadMutualFunds();
    const ppfAccounts = loadPPFAccounts();

    return NextResponse.json({
      investments,
      loans,
      properties,
      bankBalances,
      stocks,
      mutualFunds,
      ppfAccounts,
    });
  } catch (error) {
    console.error("Error fetching portfolio snapshot:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio data" }, { status: 500 });
  }
}
