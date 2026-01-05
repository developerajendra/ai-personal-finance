import { NextRequest, NextResponse } from "next/server";
import { sendChatMessage } from "@/core/services/geminiService";
import { ChatContext } from "@/core/services/geminiService";
import { loadAllPortfolioData, loadStocks, loadMutualFunds } from "@/core/services/jsonStorageService";
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
    
    // Load stocks and mutual funds from JSON cache
    const stocks = loadStocks();
    const mutualFunds = loadMutualFunds();

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
      stocks: context?.stocks || stocks,
      mutualFunds: context?.mutualFunds || mutualFunds,
    };

    console.log(`[Chatbot] Loaded context: ${chatContext.transactions.length} transactions, ${chatContext.investments?.length || 0} investments, ${chatContext.loans?.length || 0} loans, ${chatContext.properties?.length || 0} properties, ${chatContext.bankBalances?.length || 0} bank balances, ${chatContext.stocks?.length || 0} stocks, ${chatContext.mutualFunds?.length || 0} mutual funds`);

    const responseText = await sendChatMessage(message, chatContext);

    // Clean up response - remove action tag for the user
    let cleanerResponse = responseText.replace(/<action>[\s\S]*?<\/action>/g, "").trim();

    // Check for actions in the response
    const actionMatch = responseText.match(/<action>([\s\S]*?)<\/action>/);

    if (actionMatch && actionMatch[1]) {
      try {
        const actionJson = JSON.parse(actionMatch[1]);

        if (actionJson.type === "create_investment" && actionJson.data) {
          console.log("[Chatbot] Detected investment creation action:", actionJson.data);

          // Validate required fields
          if (!actionJson.data.amount || parseFloat(actionJson.data.amount) <= 0) {
            throw new Error("Investment amount is required and must be greater than 0");
          }

          // Parse and validate dates
          const today = new Date().toISOString().split('T')[0];
          let startDate = actionJson.data.startDate || today;
          let maturityDate = actionJson.data.maturityDate;

          // Validate date format
          if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            startDate = today;
          }
          if (maturityDate && !/^\d{4}-\d{2}-\d{2}$/.test(maturityDate)) {
            maturityDate = undefined;
          }

          // Create new investment
          const newInvestment: any = {
            id: `inv-${Date.now()}`,
            name: actionJson.data.name || `New ${actionJson.data.type?.toUpperCase() || 'Investment'}`,
            amount: parseFloat(actionJson.data.amount),
            type: actionJson.data.type || "other",
            startDate: startDate,
            maturityDate: maturityDate,
            interestRate: actionJson.data.interestRate ? parseFloat(actionJson.data.interestRate) : undefined,
            description: actionJson.data.description,
            status: "active",
            isPublished: false, // Draft mode - always create in draft
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Save to storage
          const { saveToJson, loadFromJson } = await import("@/core/services/jsonStorageService");
          const { investments } = await import("@/core/dataStore");

          // Reload latest data to ensure no conflicts
          initializeStorage();
          const currentInvestments = loadFromJson("investments");
          currentInvestments.push(newInvestment);
          saveToJson("investments", currentInvestments);

          // Update in-memory store
          investments.push(newInvestment);

          console.log("[Chatbot] ✅ Created draft investment:", newInvestment.id, newInvestment.name, `Rs ${newInvestment.amount}`);
          
          // Enhance the response message with investment details
          const investmentDetails = `\n\n**Investment Created:**\n- Name: ${newInvestment.name}\n- Amount: Rs ${newInvestment.amount.toLocaleString()}\n- Type: ${newInvestment.type}\n- Start Date: ${newInvestment.startDate}\n${newInvestment.maturityDate ? `- Maturity Date: ${newInvestment.maturityDate}\n` : ''}${newInvestment.interestRate ? `- Interest Rate: ${newInvestment.interestRate}%\n` : ''}\n✅ This investment has been saved in **draft mode**. You can find it in the Admin Panel → Portfolio tab under the Investments section. Review and publish it when you're ready!`;
          
          // Append investment details to the response
          const enhancedResponse = cleanerResponse + investmentDetails;
          return NextResponse.json({ response: enhancedResponse });
        }

        if (actionJson.type === "update_investment" && actionJson.data) {
          console.log("[Chatbot] Detected investment update action:", actionJson.data);

          // Load all investments (including drafts) to find the one to update
          const { saveToJson, loadFromJson } = await import("@/core/services/jsonStorageService");
          const { investments } = await import("@/core/dataStore");

          initializeStorage();
          const allInvestments = loadFromJson("investments");
          
          // Find investment by name (case-insensitive partial match)
          const investmentName = actionJson.data.investmentName?.toLowerCase() || "";
          const investmentIndex = allInvestments.findIndex((inv: any) => 
            inv.name?.toLowerCase().includes(investmentName) || 
            investmentName.includes(inv.name?.toLowerCase() || "")
          );

          if (investmentIndex === -1) {
            throw new Error(`Investment "${actionJson.data.investmentName}" not found. Please check the investment name and try again.`);
          }

          const investment = allInvestments[investmentIndex] as any;
          const updatedInvestment = { ...investment };

          // Update fields if provided
          if (actionJson.data.amount !== undefined) {
            updatedInvestment.amount = parseFloat(actionJson.data.amount);
          }
          if (actionJson.data.interestRate !== undefined) {
            updatedInvestment.interestRate = parseFloat(actionJson.data.interestRate);
          }
          if (actionJson.data.maturityDate !== undefined) {
            if (actionJson.data.maturityDate && /^\d{4}-\d{2}-\d{2}$/.test(actionJson.data.maturityDate)) {
              updatedInvestment.maturityDate = actionJson.data.maturityDate;
            }
          }
          if (actionJson.data.status !== undefined) {
            updatedInvestment.status = actionJson.data.status;
          }
          if (actionJson.data.description !== undefined) {
            updatedInvestment.description = actionJson.data.description;
          }
          if (actionJson.data.startDate !== undefined) {
            if (actionJson.data.startDate && /^\d{4}-\d{2}-\d{2}$/.test(actionJson.data.startDate)) {
              updatedInvestment.startDate = actionJson.data.startDate;
            }
          }

          updatedInvestment.updatedAt = new Date().toISOString();

          // Update in array
          allInvestments[investmentIndex] = updatedInvestment;
          saveToJson("investments", allInvestments);

          // Update in-memory store
          const memIndex = investments.findIndex((inv: any) => inv.id === investment.id);
          if (memIndex !== -1) {
            investments[memIndex] = updatedInvestment;
          }

          console.log("[Chatbot] ✅ Updated investment:", updatedInvestment.id, updatedInvestment.name);
          
          // Enhance the response message with update details
          const updateDetails = `\n\n**Investment Updated:**\n- Name: ${updatedInvestment.name}\n${actionJson.data.amount !== undefined ? `- Amount: Rs ${updatedInvestment.amount.toLocaleString()}\n` : ''}${actionJson.data.interestRate !== undefined ? `- Interest Rate: ${updatedInvestment.interestRate}%\n` : ''}${actionJson.data.maturityDate ? `- Maturity Date: ${updatedInvestment.maturityDate}\n` : ''}✅ The investment has been updated successfully. You can review it in the Admin Panel → Portfolio tab.`;
          
          // Append update details to the response
          const enhancedResponse = cleanerResponse + updateDetails;
          return NextResponse.json({ response: enhancedResponse });
        }
      } catch (e) {
        console.error("[Chatbot] Failed to execute action:", e);
        // If action failed, still return the cleaned response
        return NextResponse.json({ 
          response: cleanerResponse + "\n\n⚠ I encountered an error while creating the investment. Please try again or create it manually in the Portfolio section." 
        });
      }
    }

    // Return the cleaned response if no action was processed
    return NextResponse.json({ response: cleanerResponse });
  } catch (error: any) {
    console.error("Chatbot API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process message" },
      { status: 500 }
    );
  }
}

