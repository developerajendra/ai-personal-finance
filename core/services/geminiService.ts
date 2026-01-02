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

- When user asks for CHARTS or VISUALIZATIONS:
  * Return chart data in JSON format wrapped in <chart> tags
  * Format: <chart>{"type":"pie|bar|line","title":"Chart Title","data":[{"name":"Category","value":1234}]}</chart>
  * For pie charts: use "pie" type with name and value fields
  * For bar charts: use "bar" type with name and value fields
  * For line charts: use "line" type with name and value fields
  * Include a descriptive title
  * After the chart JSON, provide a brief explanation of what the chart shows

- Answer questions about:
  * Investments: types, amounts, returns, maturity dates
  * Loans: outstanding amounts, interest rates, EMIs, repayment schedules
  * Properties: values, locations, rental income potential
  * Bank balances: account types, balances, liquidity
  * Transactions: spending patterns, income sources, category breakdowns
  * Overall financial position and health`;

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


