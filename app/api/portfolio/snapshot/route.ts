import { NextResponse } from "next/server";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, loadStocks, loadMutualFunds } from "@/core/services/jsonStorageService";
import { loadPPFAccounts } from "@/core/services/ppfStorageService";
import { Investment, Loan, Property, BankBalance } from "@/core/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const [rawInvestments, rawLoans, rawProperties, rawBankBalances] = await Promise.all([
      loadFromJson<Investment>("investments", userId),
      loadFromJson<Loan>("loans", userId),
      loadFromJson<Property>("properties", userId),
      loadFromJson<BankBalance>("bankBalances", userId),
    ]);

    const investments = rawInvestments
      .map((inv) => ({ ...inv, isPublished: inv.isPublished ?? false }))
      .filter((inv) => inv.isPublished);

    const loans = rawLoans.filter((l) => l.isPublished ?? false);
    const properties = rawProperties.filter((p) => p.isPublished ?? false);
    const bankBalances = rawBankBalances.filter((bb) => bb.isPublished ?? false);

    const [stocks, mutualFunds, ppfAccounts] = await Promise.all([
      loadStocks(userId),
      loadMutualFunds(userId),
      loadPPFAccounts(userId),
    ]);

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
