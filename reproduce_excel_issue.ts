
import { generateJsonContent } from "./core/services/ollamaService";

// Dummy data simulating Excel rows - increased to 30 rows to stress context window
const dummyData = Array.from({ length: 30 }, (_, i) => ({
  Entity: `Test Investment ${i + 1}`,
  "Debit IC": 10000 + (i * 1000),
  "Debit NC": 0,
  Credit: 0,
  "YTD Value": 12000 + (i * 1200),
  Remarks: `Interest ${10 + (i % 5)}%`,
  "Start Date": "2023",
  "Maturity Date": "2025"
}));

async function testExcelAnalysis() {
  const dataString = JSON.stringify(dummyData, null, 2);
  const prompt = `You are a financial data analyst AI. Analyze the following Excel data and intelligently extract, categorize, and structure all financial items.

Excel Data:
${dataString}

YOUR TASK:
1. EXTRACT: Read each row and extract all relevant financial information
2. INTERPRET: Understand what each item represents (investment, loan, property, deposit, etc.)
3. CATEGORIZE: Intelligently assign categories and labels based on content analysis
4. STRUCTURE: Organize into proper JSON format

COLUMN STRUCTURE:
- Entity: Name/description of the financial item
- Debit IC: Initial Capital amount
- Debit NC: New Capital amount  
- Credit: Credit amount
- YTD Value: Year to Date Value (current/maturity value)
- Remarks: Additional context (interest rates, terms, notes)
- Start Date: Start date (may be year like "2022" or full date)
- Maturity Date: Maturity/end date (may be year like "2036" or full date)

CATEGORIZATION RULES:

INVESTMENTS - Identify and categorize:
- PPF (Public Provident Fund): Entity contains "PPF" or "Public Provident"
- FD (Fixed Deposit): Entity contains "FD", "Fixed Deposit", or bank names with deposit context
- Mutual Funds: Entity contains "Mutual Fund", "MF", "SIP", fund names
- Stocks/Equity: Entity contains "Stock", "Equity", "Share", "NSE", "BSE"
- Bonds: Entity contains "Bond", "Debenture"
- Bank Deposits: Bank names (Kumari Bank, Agricultural Development Bank, etc.) with deposit amounts
- PF/EPF: Entity contains "PF", "EPF", "Provident Fund", "Employee Provident"
- Recurring Deposits: Entity contains "RD", "Recurring Deposit"
- Other: Any other investment vehicle

LOANS - Identify and categorize:
- Home Loan: Entity contains "Home", "House", "Housing", "Property Loan"
- Car Loan: Entity contains "Car", "Vehicle", "Auto"
- Personal Loan: Entity contains "Personal Loan"
- Education Loan: Entity contains "Education", "Student"
- Business Loan: Entity contains "Business", "Commercial"
- Other: Any other loan type

PROPERTIES - Identify and categorize:
- House: Entity contains "House", "Home" (as property, not loan)
- Plot: Entity contains "Plot", "Land"
- Apartment: Entity contains "Apartment", "Flat"
- Commercial: Entity contains "Commercial", "Shop", "Office"
- Other: Any other property type

BANK BALANCES - Identify and categorize:
- Bank Account: Entity contains bank names (e.g., "Kumari Bank", "Agricultural Development Bank", "Nabil Bank", "Nepal Bank") and has a balance. Look for "Account No:", "A/C:", "Balance:" in Remarks.
- Credit Card: Entity contains "Credit Card" or specific card names.

EXTRACTION LOGIC:
For each row, analyze:
1. Entity name to determine type
2. Amount fields (prioritize YTD Value, then Debit IC + Debit NC, then Credit)
3. Dates (convert year strings "2022" to "2022-01-01")
4. Extract interest rates from Remarks (look for percentages like "12%", "5.5%")
5. Extract EMI amounts from Remarks (look for "X Per Month", "EMI: X")
6. Extract bank name, account number, account type from Entity or Remarks for Bank Balances.
7. Determine status (active, matured, closed) based on dates

OUTPUT FORMAT:

Return ONLY a valid JSON object in this exact format (no markdown, no explanations, just pure JSON):
{
  "investments": [
    {
      "name": "string - use Entity value, make it descriptive",
      "amount": number - use YTD Value if available, else Debit IC + Debit NC, else Credit,
      "type": "ppf" | "fd" | "mutual-fund" | "stocks" | "bonds" | "bank-deposit" | "pf" | "other",
      "startDate": "YYYY-MM-DD" - convert year "2022" to "2022-01-01",
      "maturityDate": "YYYY-MM-DD" or null - convert year "2036" to "2036-01-01",
      "interestRate": number or null - extract from Remarks if mentioned,
      "status": "active" | "matured" | "closed" - determine from dates
    }
  ],
  "loans": [
    {
      "name": "string - use Entity value",
      "type": "home-loan" | "car-loan" | "personal-loan" | "education-loan" | "business-loan" | "other",
      "principalAmount": number - use largest of Debit IC, Debit NC, or Credit,
      "outstandingAmount": number - use Debit IC or Credit (outstanding balance),
      "interestRate": number - extract from Remarks (look for %), default 0,
      "emiAmount": number - extract from Remarks (look for "X Per Month"), default 0,
      "startDate": "YYYY-MM-DD" - convert year strings,
      "tenureMonths": number - calculate from start and maturity dates if available, else 0,
      "status": "active" | "closed" | "foreclosed"
    }
  ],
      "properties": [
        {
          "name": "string - use Entity value",
          "type": "house" | "plot" | "apartment" | "commercial" | "land" | "other",
          "purchasePrice": number - use Debit IC or Credit,
          "currentValue": number or null - use YTD Value if available,
          "location": "string" - extract from Remarks or Entity if mentioned, else "Unknown",
          "purchaseDate": "YYYY-MM-DD" - convert start date,
          "status": "owned" | "rented-out" | "under-construction"
        }
      ],
      "bankBalances": [
        {
          "bankName": "string - extract bank name from Entity or Remarks",
          "accountNumber": "string - extract from Remarks if available, else empty string",
          "accountType": "savings" | "current" | "salary" | "fd" | "rd" | "other",
          "balance": number - use YTD Value or Credit (current balance),
          "currency": "string - default 'INR'",
          "lastUpdated": "YYYY-MM-DD" - use current date or date from remarks
        }
      ]
    }

CRITICAL RULES:
1. Analyze EVERY row with a valid Entity value
2. Intelligently categorize based on Entity name and context
3. Extract all available information (amounts, dates, rates)
4. Use YTD Value for current/maturity values when available
5. Convert year strings to proper dates (2022 -> 2022-01-01)
6. Extract percentages and EMI amounts from Remarks field
7. Only return valid JSON, no markdown formatting
8. Include ALL identifiable financial items - be comprehensive`;

  console.log("Testing Excel Analysis prompt with Ollama...");
  try {
    const result = await generateJsonContent(prompt);
    console.log("Analysis Result:", JSON.stringify(result, null, 2));
    if (result.investments && result.investments.length > 0) {
      console.log("✅ Successfully extracted investments!");
    } else {
      console.log("⚠️ No investments extracted.");
    }
  } catch (error) {
    console.error("❌ Analysis Failed:", error);
  }
}

testExcelAnalysis();
