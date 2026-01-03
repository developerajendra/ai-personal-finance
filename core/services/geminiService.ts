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
  * Format numbers as currency (Rs for INR)
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
  
- CRITICAL: When user asks to CREATE, ADD, or INVEST money (e.g., "create a new fixed deposit", "add an investment of 5000", "create investment", "make an investment"):
  * You have the ability to create DRAFT investments that will be saved to the system.
  * You MUST output an <action> tag with the investment details in JSON format.
  * Parse the user's request to extract:
    - name: Investment name (e.g., "HDFC Fixed Deposit", "SBI PPF", "Reliance Mutual Fund")
    - amount: Investment amount (required, extract from user message)
    - type: Investment type - map from user's words:
      * "ppf", "public provident fund" → "ppf"
      * "fd", "fixed deposit", "term deposit" → "fd"
      * "mutual fund", "mf", "mutual-fund" → "mutual-fund"
      * "stocks", "equity", "shares" → "stocks"
      * "bonds", "government bonds" → "bonds"
      * default → "other"
    - startDate: Start date (default to today in YYYY-MM-DD format if not provided)
    - maturityDate: Maturity date (optional, extract if mentioned, format: YYYY-MM-DD)
    - interestRate: Interest rate (optional, infer if type suggests it)
  * The format MUST be:
    <action>
    {
      "type": "create_investment",
      "data": {
        "name": "Investment Name",
        "amount": 10000,
        "type": "fd",
        "startDate": "2026-01-15",
        "maturityDate": "2027-01-15",
        "interestRate": 7.5
      }
    }
    </action>
  * After the <action> tag, provide a friendly confirmation message like:
    "I've created a draft investment for you: [Name] of Rs [Amount] ([Type]). 
    It's been saved in draft mode and you can find it in the Portfolio tab under Investments. 
    You can review and publish it when ready!"
  * If the user doesn't provide enough details (like amount), ask for clarification before creating.

- CRITICAL: When user asks to UPDATE or MODIFY an investment (e.g., "update kushum ppf amount to 100", "change investment amount", "modify investment"):
  * You have the ability to update existing investments in the system.
  * You MUST output an <action> tag with the update details in JSON format.
  * Parse the user's request to extract:
    - investmentName: Name or identifier of the investment to update (required, search in existing investments)
    - amount: New amount (if mentioned)
    - interestRate: New interest rate (if mentioned)
    - maturityDate: New maturity date (if mentioned)
    - status: New status (if mentioned)
    - description: New description (if mentioned)
  * The format MUST be:
    <action>
    {
      "type": "update_investment",
      "data": {
        "investmentName": "Kushum PPF",
        "amount": 100,
        "interestRate": 7.5,
        "maturityDate": "2027-01-15"
      }
    }
    </action>
  * After the <action> tag, provide a friendly confirmation message like:
    "I've updated the investment [Name]. The changes have been saved. You can review it in the Portfolio tab."
  * If the investment name cannot be found, ask the user to clarify which investment they want to update.`;

  try {
    return await generateChatContent(message, systemPrompt);
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw new Error("Failed to get response from AI");
  }
}

function formatFinancialContext(context: ChatContext): string {
  const { transactions, summary, categories, investments, loans, properties, bankBalances } = context;

  const separator = '='.repeat(55);
  let formatted = '\n' + separator + '\n';
  formatted += 'COMPREHENSIVE FINANCIAL PORTFOLIO DATA\n';
  formatted += separator + '\n\n';

  // TRANSACTIONS SUMMARY
  formatted += 'TRANSACTIONS SUMMARY:\n';
  formatted += '- Total Income: Rs ' + summary.totalIncome.toLocaleString() + '\n';
  formatted += '- Total Expenses: Rs ' + summary.totalExpenses.toLocaleString() + '\n';
  formatted += '- Net Balance: Rs ' + summary.netBalance.toLocaleString() + '\n\n';

  if (Object.keys(summary.categoryBreakdown).length > 0) {
    formatted += 'Category Breakdown:\n';
    Object.entries(summary.categoryBreakdown).forEach(([category, amount]) => {
      formatted += '  - ' + category + ': Rs ' + amount.toLocaleString() + '\n';
    });
    formatted += '\n';
  }

  if (transactions && transactions.length > 0) {
    formatted += 'Recent Transactions (last 15):\n';
    const recentTransactions = transactions.slice(0, 15);
    recentTransactions.forEach((tx) => {
      formatted += '  - ' + tx.date + ': ' + tx.description + ' - Rs ' + tx.amount.toLocaleString() + ' (' + tx.type + ', ' + tx.category + ')\n';
    });
    formatted += '\n';
  }

  // INVESTMENTS
  if (investments && investments.length > 0) {
    const totalInvestments = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const investmentsByType = investments.reduce((acc, inv) => {
      acc[inv.type] = (acc[inv.type] || 0) + (inv.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += 'INVESTMENTS (Total: Rs ' + totalInvestments.toLocaleString() + '):\n';
    formatted += '- Count: ' + investments.length + ' investments\n';
    Object.entries(investmentsByType).forEach(([type, amount]) => {
      formatted += '  - ' + type + ': Rs ' + amount.toLocaleString() + ' (' + investments.filter(i => i.type === type).length + ' items)\n';
    });
    formatted += '\nTop Investments:\n';
    investments.slice(0, 10).forEach((inv) => {
      formatted += '  - ' + inv.name + ': Rs ' + (inv.amount?.toLocaleString() || 0) + ' (' + inv.type + ', ' + (inv.status || 'active') + ')';
      if (inv.interestRate) formatted += ' @ ' + inv.interestRate + '%';
      if (inv.maturityDate) formatted += ', Matures: ' + inv.maturityDate;
      formatted += '\n';
    });
    formatted += '\n';
  }

  // LOANS
  if (loans && loans.length > 0) {
    const totalOutstanding = loans.reduce((sum, loan) => sum + (loan.outstandingAmount || 0), 0);
    const totalPrincipal = loans.reduce((sum, loan) => sum + (loan.principalAmount || 0), 0);
    const loansByType = loans.reduce((acc, loan) => {
      acc[loan.type] = (acc[loan.type] || 0) + (loan.outstandingAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += 'LOANS (Total Outstanding: Rs ' + totalOutstanding.toLocaleString() + '):\n';
    formatted += '- Count: ' + loans.length + ' loans\n';
    formatted += '- Total Principal: Rs ' + totalPrincipal.toLocaleString() + '\n';
    Object.entries(loansByType).forEach(([type, amount]) => {
      formatted += '  - ' + type + ': Rs ' + amount.toLocaleString() + ' outstanding\n';
    });
    formatted += '\nActive Loans:\n';
    loans.slice(0, 10).forEach((loan) => {
      formatted += '  - ' + loan.name + ': Rs ' + (loan.outstandingAmount?.toLocaleString() || 0) + ' outstanding';
      if (loan.interestRate) formatted += ' @ ' + loan.interestRate + '%';
      if (loan.emiAmount) formatted += ', EMI: Rs ' + loan.emiAmount.toLocaleString();
      formatted += ' (' + (loan.status || 'active') + ')\n';
    });
    formatted += '\n';
  }

  // PROPERTIES
  if (properties && properties.length > 0) {
    const totalPropertyValue = properties.reduce((sum, prop) => sum + (prop.currentValue || prop.purchasePrice || 0), 0);
    const totalPurchasePrice = properties.reduce((sum, prop) => sum + (prop.purchasePrice || 0), 0);
    const propertiesByType = properties.reduce((acc, prop) => {
      acc[prop.type] = (acc[prop.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    formatted += 'PROPERTIES (Total Value: Rs ' + totalPropertyValue.toLocaleString() + '):\n';
    formatted += '- Count: ' + properties.length + ' properties\n';
    formatted += '- Total Purchase Price: Rs ' + totalPurchasePrice.toLocaleString() + '\n';
    Object.entries(propertiesByType).forEach(([type, count]) => {
      formatted += '  - ' + type + ': ' + count + ' properties\n';
    });
    formatted += '\nProperties:\n';
    properties.slice(0, 10).forEach((prop) => {
      formatted += '  - ' + prop.name + ': Rs ' + (prop.currentValue || prop.purchasePrice || 0).toLocaleString();
      if (prop.location && prop.location !== "Unknown") formatted += ' (' + prop.location + ')';
      formatted += ' (' + prop.type + ', ' + (prop.status || 'owned') + ')\n';
    });
    formatted += '\n';
  }

  // BANK BALANCES
  if (bankBalances && bankBalances.length > 0) {
    const totalBalance = bankBalances.reduce((sum, bb) => sum + (bb.balance || 0), 0);
    const balancesByBank = bankBalances.reduce((acc, bb) => {
      acc[bb.bankName] = (acc[bb.bankName] || 0) + (bb.balance || 0);
      return acc;
    }, {} as Record<string, number>);

    formatted += 'BANK BALANCES (Total: Rs ' + totalBalance.toLocaleString() + '):\n';
    formatted += '- Count: ' + bankBalances.length + ' accounts\n';
    Object.entries(balancesByBank).forEach(([bank, balance]) => {
      formatted += '  - ' + bank + ': Rs ' + balance.toLocaleString() + '\n';
    });
    formatted += '\nAccounts:\n';
    bankBalances.slice(0, 10).forEach((bb) => {
      formatted += '  - ' + bb.bankName + ' (' + bb.accountType + '): Rs ' + (bb.balance?.toLocaleString() || 0);
      if (bb.accountNumber) formatted += ' - A/C: ' + bb.accountNumber;
      formatted += '\n';
    });
    formatted += '\n';
  }

  formatted += 'Available Categories: ' + categories.join(", ") + '\n';
  formatted += separator + '\n';

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


