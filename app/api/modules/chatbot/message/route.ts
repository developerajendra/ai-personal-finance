import { NextRequest, NextResponse } from "next/server";
import { sendChatMessage } from "@/core/services/geminiService";
import { ChatContext } from "@/core/services/geminiService";
import { loadAllPortfolioData, loadStocks, loadMutualFunds } from "@/core/services/jsonStorageService";
import { detectAuditIntent, callAuditAgent, extractAuditUrl, auditScrapedPageData, auditWithScreenshot } from "@/core/services/mcpAuditService";
import { getSession } from "@/core/auth/getSession";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const body = await request.json();
    const { message, agent, context, currentPage, pageData, screenshot } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Route to finance audit agent when selected via dropdown OR auto-detected
    const isAuditAgent = agent === "audit-finance";
    const auditRequest = isAuditAgent
      ? extractAuditUrl(message) // In audit mode, always try to extract URL
      : detectAuditIntent(message); // In ask mode, auto-detect audit intent

    if (auditRequest) {
      console.log(`[Chatbot] Routing to audit agent for: ${auditRequest.url}`);
      try {
        const auditResult = await callAuditAgent(auditRequest);

        // Use AI to rephrase the audit result in a conversational tone
        const { getModelForUseCase } = await import("@/core/services/aiModelService");
        const { generateChatContent: generateChatContentGemini } = await import("@/core/services/geminiJsonService");
        const { generateChatContent: generateChatContentOllama } = await import("@/core/services/ollamaService");

        const { provider } = getModelForUseCase('chat');
        const rephrasePrompt = `You are a helpful financial assistant. The user asked to audit a finance calculator. Here are the raw audit results from our Finance Audit Agent:

${auditResult}

Please rephrase these findings in a friendly, conversational tone. Important rules:
- Never claim 100% certainty - use phrases like "it appears", "I noticed", "there might be"
- Highlight the most important issues first
- Keep it concise but informative
- Use markdown formatting for readability
- End with a brief recommendation

User's original message: "${message}"`;

        let conversationalResponse: string;
        if (provider === 'gemini') {
          conversationalResponse = await generateChatContentGemini(rephrasePrompt);
        } else {
          conversationalResponse = await generateChatContentOllama(rephrasePrompt);
        }

        return NextResponse.json({ response: conversationalResponse });
      } catch (auditError: any) {
        console.error("[Chatbot] Audit failed:", auditError);
        return NextResponse.json({
          response: `I tried to audit the calculator at ${auditRequest.url}, but encountered an error: ${auditError.message || 'Unknown error'}. This might happen if the page requires special access, uses complex dynamic loading, or if the audit agent service is not available. You can try again or provide a different URL.`
        });
      }
    }

    const portfolioData = loadAllPortfolioData(userId);
    
    const stocks = loadStocks(userId);
    const mutualFunds = loadMutualFunds(userId);

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

    // If audit-finance mode is selected but no external URL was provided,
    // use the vision-first approach: analyze a screenshot of the page
    if (isAuditAgent) {
      const pagePath = currentPage || '/dashboard';

      // Priority 1: Vision-first audit via screenshot (preferred)
      if (screenshot && typeof screenshot === 'string' && screenshot.length > 100) {
        console.log(`[Chatbot] Audit Finance mode: vision-first analysis from ${pagePath} (${(screenshot.length / 1024).toFixed(0)} KB screenshot)`);
        try {
          const auditResponse = await auditWithScreenshot(message, screenshot, pagePath);
          return NextResponse.json({ response: auditResponse });
        } catch (auditError: any) {
          console.error("[Chatbot] Visual audit failed:", auditError);
          // Fall through to DOM scraping fallback
          console.log("[Chatbot] Falling back to DOM scraping approach...");
        }
      }

      // Priority 2: Fallback to DOM-scraped data (legacy)
      const hasTableData = pageData?.tables?.length > 0 && pageData.tables.some(
        (t: any) => t.rows?.length > 0
      );
      const hasSummaryCards = pageData?.summaryCards?.length > 0;

      if (pageData && (hasTableData || hasSummaryCards)) {
        console.log(`[Chatbot] Audit Finance mode: fallback to scraped data from ${pagePath} (${pageData.tables?.length || 0} tables, ${pageData.summaryCards?.length || 0} summary cards)`);
        try {
          const auditResponse = await auditScrapedPageData(message, pageData, pagePath);
          return NextResponse.json({ response: auditResponse });
        } catch (auditError: any) {
          console.error("[Chatbot] Page data audit failed:", auditError);
          return NextResponse.json({
            response: `I encountered an error while auditing the data on \`${pagePath}\`: ${auditError.message || 'Unknown error'}. Please try again.`
          });
        }
      }

      // No screenshot and no scraped data — cannot audit
      console.log(`[Chatbot] Audit Finance mode: no data available on ${pagePath}`);
      return NextResponse.json({
        response: `No financial data found on the current page (\`${pagePath}\`). Please navigate to a page with financial data (e.g., Portfolio, Investments, Loans, Stocks) and try again.`
      });
    }

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

          const { saveToJson, loadFromJson } = await import("@/core/services/jsonStorageService");

          const currentInvestments = loadFromJson<{ id: string }>("investments", userId);
          currentInvestments.push(newInvestment);
          saveToJson("investments", currentInvestments, userId);

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

          const allInvestments = loadFromJson("investments", userId);
          
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
          saveToJson("investments", allInvestments as { id: string }[], userId);

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

