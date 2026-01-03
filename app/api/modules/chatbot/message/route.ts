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

    // Filter to only published items for dashboard/analytics (chatbot should use published data)
    const publishedInvestments = (portfolioData.investments || []).filter((inv: any) => inv.isPublished === true);
    const publishedLoans = (portfolioData.loans || []).filter((loan: any) => loan.isPublished === true);
    const publishedProperties = (portfolioData.properties || []).filter((prop: any) => prop.isPublished === true);
    const publishedBankBalances = (portfolioData.bankBalances || []).filter((bb: any) => bb.isPublished === true);

    // Merge provided context with loaded portfolio data
    // If context is provided, use it; otherwise use loaded data
    // For portfolio items, use published data only (for accurate analytics)
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
      investments: context?.investments || publishedInvestments,
      loans: context?.loans || publishedLoans,
      properties: context?.properties || publishedProperties,
      bankBalances: context?.bankBalances || publishedBankBalances,
    };

    console.log(`[Chatbot] Loaded context: ${chatContext.transactions.length} transactions, ${chatContext.investments?.length || 0} investments, ${chatContext.loans?.length || 0} loans, ${chatContext.properties?.length || 0} properties, ${chatContext.bankBalances?.length || 0} bank balances`);

    const responseText = await sendChatMessage(message, chatContext);

    // Check for actions in the response
    const actionMatch = responseText.match(/<action>([\s\S]*?)<\/action>/);

    if (actionMatch && actionMatch[1]) {
      try {
        const actionJson = JSON.parse(actionMatch[1]);

        if (actionJson.type === "create_investment" && actionJson.data) {
          console.log("[Chatbot] Detected investment creation action:", actionJson.data);

          // Create new investment
          const newInvestment: any = {
            id: `inv-${Date.now()}`,
            name: actionJson.data.name || "New Investment",
            amount: parseFloat(actionJson.data.amount) || 0,
            type: actionJson.data.type || "other",
            startDate: actionJson.data.startDate || new Date().toISOString().split('T')[0],
            maturityDate: actionJson.data.maturityDate,
            interestRate: parseFloat(actionJson.data.interestRate) || undefined,
            status: "active",
            isPublished: false, // Draft mode
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Save to storage
          const { saveToJson, loadFromJson } = await import("@/core/services/jsonStorageService");
          const { investments } = await import("@/core/dataStore");

          // Reload latest data to ensure no conflicts
          const currentInvestments = loadFromJson("investments");
          currentInvestments.push(newInvestment);
          saveToJson("investments", currentInvestments);

          // Update in-memory store
          investments.push(newInvestment);

          console.log("[Chatbot] created draft investment:", newInvestment.id);
        }
      } catch (e) {
        console.error("[Chatbot] Failed to execute action:", e);
      }
    }

    // Clean up response - remove action tag for the user
    const cleanerResponse = responseText.replace(/<action>[\s\S]*?<\/action>/g, "").trim();

    return NextResponse.json({ response: cleanerResponse });
  } catch (error: any) {
    console.error("Chatbot API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process message" },
      { status: 500 }
    );
  }
}

