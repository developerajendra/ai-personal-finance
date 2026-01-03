import { generateChatContent } from "./ollamaService";
import { Transaction, FinancialSummary, Investment, Loan, Property, BankBalance } from "@/core/types";

// Re-export or redefine ChatContext here if needed to avoid breaking other files
export interface ChatContext {
  transactions: Transaction[];
  summary: FinancialSummary;
  categories: string[];
  investments?: Investment[];
  loans?: Loan[];
  properties?: Property[];
  bankBalances?: BankBalance[];
}

export async function sendChatMessage(
  message: string,
  context: ChatContext
): Promise<string> {
  // Format financial data for context
  const financialContext = formatFinancialContext(context);

  const systemPrompt = `You are a comprehensive financial assistant with access to the user's complete financial portfolio. 
Use ALL available data to answer questions accurately and provide comprehensive insights.

Financial Data Context:
${financialContext}

CRITICAL CHART GENERATION RULES:
- When user asks for "chart", "show me a chart", "visualize", "graph", or similar:
  * IMMEDIATELY generate a chart - DO NOT ask what type they want
  * AUTOMATICALLY choose the best chart type:
    - "pie" for category breakdowns (investment types, expense categories, loan types)
    - "bar" for comparisons (amounts, monthly data, rankings)
    - "line" for trends over time
  * ALWAYS use this EXACT format: <chart>{"type":"bar","title":"Your Title","data":[{"name":"Item","value":1234}]}</chart>
  * Example for investment breakdown:
    <chart>{"type":"pie","title":"Investments by Type","data":[{"name":"FD","value":50000},{"name":"PPF","value":30000},{"name":"Mutual Funds","value":20000}]}</chart>
  * Example for expense categories:
    <chart>{"type":"bar","title":"Monthly Expenses by Category","data":[{"name":"Food","value":5000},{"name":"Transport","value":3000},{"name":"Bills","value":2000}]}</chart>
  * After the chart, add 1-2 sentences explaining what it shows
  * NEVER ask "what kind of chart?" - just generate it automatically

IMPORTANT INSTRUCTIONS:
- When asked for a summary, provide a COMPREHENSIVE overview including:
  * Total investments value and breakdown by type
  * Total loans outstanding and breakdown by type
  * Total properties value and breakdown
  * Total bank balances across all accounts
  * Transaction summary (income, expenses, net balance)
  * Overall financial health assessment

- When presenting data:
  * Use tables for structured data
  * Format numbers as currency (₹ for INR)
  * Be comprehensive - include all relevant portfolio data
  * Provide actionable insights and recommendations
  * Calculate totals and percentages when relevant
  * Highlight important patterns or concerns

- CRITICAL: When user asks for CHARTS, VISUALIZATIONS, or "show me a chart":
  * AUTOMATICALLY generate and return a chart - DO NOT ask what kind of chart they want
  * AUTOMATICALLY choose the best chart type based on the data:
    - Use "pie" for category breakdowns (investments by type, expenses by category, etc.)
    - Use "bar" for comparisons (monthly spending, loan amounts, etc.)
    - Use "line" for trends over time
  * ALWAYS wrap chart data in <chart> tags with this EXACT format:
    <chart>{"type":"bar","title":"Investment Breakdown by Type","data":[{"name":"FD","value":50000},{"name":"PPF","value":30000}]}</chart>
  * Chart JSON structure:
    - type: "pie" | "bar" | "line" (choose automatically)
    - title: Descriptive title for the chart
    - data: Array of objects with "name" and "value" fields
  * Examples of automatic chart generation:
    - "show me a chart" → Generate bar chart of expenses by category
    - "chart of investments" → Generate pie chart of investments by type
    - "visualize my loans" → Generate bar chart of loans by type
  * After the <chart> tag, provide a brief explanation (1-2 sentences)
  * DO NOT ask questions - just generate the chart automatically

- Answer questions about:
  * Investments: types, amounts, returns, maturity dates
  * Loans: outstanding amounts, interest rates, EMIs, repayment schedules
  * Properties: values, locations, rental income potential
  * Bank balances: account types, balances, liquidity
  * Transactions: spending patterns, income sources, category breakdowns
  * Overall financial position and health
  
- CRITICAL: When user asks to CREATE, ADD, or INVEST money (e.g., "create a new fixed deposit", "add an investment of 5000"):
  * You have the ability to create DRAFT investments.
  * You MUST output an <action> tag with the investment details in JSON format.
  * infer missing details (like start date = today) if not provided.
  * The format MUST be:
    <action>
    {
      "type": "create_investment",
      "data": {
        "name": "Investment Name",
        "amount": 10000,
        "type": "fd", // Options: ppf, fd, mutual-fund, stocks, bonds, other
        "interestRate": 7.5, // Optional, infer if possible
        "startDate": "YYYY-MM-DD",
        "maturityDate": "YYYY-MM-DD" // Optional
      }
    }
    </action>
  * After the <action> tag, provide a confirmation message like "I've created a draft for your new investment..."`;

  try {
    return await generateChatContent(message, systemPrompt);
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw new Error("Failed to get response from AI");
  }
}

function formatFinancialContext(context: ChatContext): string {
  const { transactions, summary, categories, investments, loans, properties, bankBalances } = context;

  let formatted = `\n═══════════════════════════════════════════════════════════\n`;
  formatted += `COMPREHENSIVE FINANCIAL PORTFOLIO DATA\n`;
  formatted += `═══════════════════════════════════════════════════════════\n\n`;

  // TRANSACTIONS SUMMARY
  formatted += `📊 TRANSACTIONS SUMMARY:\n`;
  formatted += `- Total Income: ₹${summary.totalIncome.toLocaleString()}\n`;
  formatted += `- Total Expenses: ₹${summary.totalExpenses.toLocaleString()}\n`;
  formatted += `- Net Balance: ₹${summary.netBalance.toLocaleString()}\n\n`;

  if (Object.keys(summary.categoryBreakdown).length > 0) {
    formatted += `Category Breakdown:\n`;
    Object.entries(summary.categoryBreakdown).forEach(([category, amount]) => {
      formatted += `  - ${category}: ₹${amount.toLocaleString()}\n`;
    });
    formatted += `\n`;
  }

  if (transactions && transactions.length > 0) {
    formatted += `Recent Transactions (last 15):\n`;
    const recentTransactions = transactions.slice(0, 15);
    recentTransactions.forEach((tx) => {
      formatted += `  - ${tx.date}: ${tx.description} - ₹${tx.amount.toLocaleString()} (${tx.type}, ${tx.category})\n`;
    });
    formatted += `\n`;
  }

  // INVESTMENTS
  if (investments && investments.length > 0) {
    const totalInvestments = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const investmentsByType = investments.reduce((acc, inv) => {
      acc[inv.type] = (acc[inv.type] || 0) + (inv.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += `💰 INVESTMENTS (Total: ₹${totalInvestments.toLocaleString()}):\n`;
    formatted += `- Count: ${investments.length} investments\n`;
    Object.entries(investmentsByType).forEach(([type, amount]) => {
      formatted += `  - ${type}: ₹${amount.toLocaleString()} (${investments.filter(i => i.type === type).length} items)\n`;
    });
    formatted += `\nTop Investments:\n`;
    investments.slice(0, 10).forEach((inv) => {
      formatted += `  - ${inv.name}: ₹${inv.amount?.toLocaleString() || 0} (${inv.type}, ${inv.status || 'active'})`;
      if (inv.interestRate) formatted += ` @ ${inv.interestRate}%`;
      if (inv.maturityDate) formatted += `, Matures: ${inv.maturityDate}`;
      formatted += `\n`;
    });
    formatted += `\n`;
  }

  // LOANS
  if (loans && loans.length > 0) {
    const totalOutstanding = loans.reduce((sum, loan) => sum + (loan.outstandingAmount || 0), 0);
    const totalPrincipal = loans.reduce((sum, loan) => sum + (loan.principalAmount || 0), 0);
    const loansByType = loans.reduce((acc, loan) => {
      acc[loan.type] = (acc[loan.type] || 0) + (loan.outstandingAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += `💳 LOANS (Total Outstanding: ₹${totalOutstanding.toLocaleString()}):\n`;
    formatted += `- Count: ${loans.length} loans\n`;
    formatted += `- Total Principal: ₹${totalPrincipal.toLocaleString()}\n`;
    Object.entries(loansByType).forEach(([type, amount]) => {
      formatted += `  - ${type}: ₹${amount.toLocaleString()} outstanding\n`;
    });
    formatted += `\nActive Loans:\n`;
    loans.slice(0, 10).forEach((loan) => {
      formatted += `  - ${loan.name}: ₹${loan.outstandingAmount?.toLocaleString() || 0} outstanding`;
      if (loan.interestRate) formatted += ` @ ${loan.interestRate}%`;
      if (loan.emiAmount) formatted += `, EMI: ₹${loan.emiAmount.toLocaleString()}`;
      formatted += ` (${loan.status || 'active'})\n`;
    });
    formatted += `\n`;
  }

  // PROPERTIES
  if (properties && properties.length > 0) {
    const totalPropertyValue = properties.reduce((sum, prop) => sum + (prop.currentValue || prop.purchasePrice || 0), 0);
    const totalPurchasePrice = properties.reduce((sum, prop) => sum + (prop.purchasePrice || 0), 0);
    const propertiesByType = properties.reduce((acc, prop) => {
      acc[prop.type] = (acc[prop.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    formatted += `🏠 PROPERTIES (Total Value: ₹${totalPropertyValue.toLocaleString()}):\n`;
    formatted += `- Count: ${properties.length} properties\n`;
    formatted += `- Total Purchase Price: ₹${totalPurchasePrice.toLocaleString()}\n`;
    Object.entries(propertiesByType).forEach(([type, count]) => {
      formatted += `  - ${type}: ${count} properties\n`;
    });
    formatted += `\nProperties:\n`;
    properties.slice(0, 10).forEach((prop) => {
      formatted += `  - ${prop.name}: ₹${(prop.currentValue || prop.purchasePrice || 0).toLocaleString()}`;
      if (prop.location && prop.location !== "Unknown") formatted += ` (${prop.location})`;
      formatted += ` (${prop.type}, ${prop.status || 'owned'})\n`;
    });
    formatted += `\n`;
  }

  // BANK BALANCES
  if (bankBalances && bankBalances.length > 0) {
    const totalBalance = bankBalances.reduce((sum, bb) => sum + (bb.balance || 0), 0);
    const balancesByBank = bankBalances.reduce((acc, bb) => {
      acc[bb.bankName] = (acc[bb.bankName] || 0) + (bb.balance || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += `🏦 BANK BALANCES (Total: ₹${totalBalance.toLocaleString()}):\n`;
    formatted += `- Count: ${bankBalances.length} accounts\n`;
    Object.entries(balancesByBank).forEach(([bank, balance]) => {
      formatted += `  - ${bank}: ₹${balance.toLocaleString()}\n`;
    });
    formatted += `\nAccounts:\n`;
    bankBalances.slice(0, 10).forEach((bb) => {
      formatted += `  - ${bb.bankName} (${bb.accountType}): ₹${bb.balance?.toLocaleString() || 0}`;
      if (bb.accountNumber) formatted += ` - A/C: ${bb.accountNumber}`;
      formatted += `\n`;
    });
    formatted += `\n`;
  }

  formatted += `Available Categories: ${categories.join(", ")}\n`;
  formatted += `═══════════════════════════════════════════════════════════\n`;

  return formatted;
}

export async function generateChartData(
  query: string,
  context: ChatContext
): Promise<any> {
  // Basic implementation for chart data
  return {
    type: "bar",
    data: Object.entries(context.summary.categoryBreakdown).map(([name, value]) => ({
      name,
      value,
    })),
  };
}


