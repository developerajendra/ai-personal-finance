import { NextRequest, NextResponse } from "next/server";
import { sendChatMessage } from "@/core/services/geminiService";
import { ChatContext } from "@/core/services/geminiService";
import { loadAllPortfolioData } from "@/core/services/jsonStorageService";
import { initializeStorage } from "@/core/services/jsonStorageService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Initialize storage and load all portfolio data from JSON files
    initializeStorage();
    const portfolioData = loadAllPortfolioData();

    // Merge provided context with loaded portfolio data
    // If context is provided, use it; otherwise use loaded data
    const chatContext: ChatContext = {
      transactions: context?.transactions || portfolioData.transactions || [],
      summary: context?.summary || {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        categoryBreakdown: {},
      },
      categories: context?.categories || Array.from(
        new Set((portfolioData.transactions || []).map((t: any) => t.category))
      ),
      investments: context?.investments || portfolioData.investments || [],
      loans: context?.loans || portfolioData.loans || [],
      properties: context?.properties || portfolioData.properties || [],
      bankBalances: context?.bankBalances || portfolioData.bankBalances || [],
    };

    console.log(`[Chatbot] Loaded context: ${chatContext.transactions.length} transactions, ${chatContext.investments?.length || 0} investments, ${chatContext.loans?.length || 0} loans, ${chatContext.properties?.length || 0} properties, ${chatContext.bankBalances?.length || 0} bank balances`);

    const response = await sendChatMessage(message, chatContext);

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Chatbot API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process message" },
      { status: 500 }
    );
  }
}

