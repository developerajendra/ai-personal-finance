import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { loadPortfolio, loadStocks, loadMutualFunds } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const {
      investments: rawInvestments,
      loans: rawLoans,
      properties: rawProperties,
      bankBalances: rawBankBalances,
    } = await loadPortfolio(userId);

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
