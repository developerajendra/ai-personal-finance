import { generateJsonContent } from "./ollamaService";
import { Investment, Loan, Property, BankBalance } from "@/core/types";
import { learnFromCategorization, suggestCategory, getCategoryPatterns } from "./categoryLearningService";

export interface ExcelAnalysisResult {
  investments: Investment[];
  loans: Loan[];
  properties: Property[];
  bankBalances: BankBalance[];
}

export async function analyzeExcelData(
  excelData: any[]
): Promise<ExcelAnalysisResult> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  EXCEL ANALYZER SERVICE - STARTING AI ANALYSIS              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`📥 Received ${excelData?.length || 0} rows of Excel data`);
  
  if (!excelData || excelData.length === 0) {
    console.warn("⚠️  No data provided to AI analysis - returning empty results");
    return { investments: [], loans: [], properties: [], bankBalances: [] };
  }

  // Format Excel data for analysis - limit to first 30 rows to avoid context limits with smaller models
  const dataToAnalyze = excelData.slice(0, 30);
  const dataString = JSON.stringify(dataToAnalyze, null, 2);

  console.log(`📊 Processing ${dataToAnalyze.length} rows for AI analysis (limited from ${excelData.length} total rows)`);

  // Get learned patterns to improve AI suggestions
  const learnedPatterns = getCategoryPatterns();
  const patternContext = learnedPatterns.length > 0
    ? `\n\nLEARNED PATTERNS (use these to improve accuracy):\n${JSON.stringify(learnedPatterns.slice(0, 10), null, 2)}`
    : "";

  const prompt = `You are an expert financial data analyst AI. Your job is to analyze Excel data and INTELLIGENTLY TRANSFORM it into structured financial data by creating your own categories, labels, and classifications.

Excel Data:
${dataString}${patternContext}

YOUR PRIMARY TASK - BE CREATIVE AND COMPREHENSIVE:
1. EXTRACT: Read EVERY row and extract ALL relevant financial information - don't skip any rows
2. INTERPRET: Use your intelligence to understand what each item represents, even if it's not explicitly stated
3. CATEGORIZE: Create intelligent categories and labels based on patterns, context, and financial knowledge
4. TRANSFORM: Convert raw data into structured financial items (investments, loans, properties, bank balances)
5. INFER: Use context clues to determine types, statuses, and relationships even when not explicitly stated
6. BE COMPREHENSIVE: Include ALL rows that could represent financial items - err on the side of inclusion

IMPORTANT: You must CREATE categories and labels based on the data patterns. Don't just extract what's explicitly there - use your intelligence to infer and categorize intelligently.

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

CRITICAL RULES - FOLLOW THESE STRICTLY:
1. Analyze EVERY SINGLE row with a valid Entity value - don't skip any
2. Use INTELLIGENT INFERENCE to categorize based on:
   - Entity name patterns and keywords
   - Amount patterns (large amounts might be properties, recurring amounts might be loans)
   - Date patterns (long-term = investments/loans, short-term = deposits)
   - Context from Remarks field
   - Financial knowledge and common patterns
3. CREATE descriptive names and labels - don't just copy Entity values verbatim
4. Extract ALL available information (amounts, dates, rates, account numbers, etc.)
5. Use YTD Value for current/maturity values when available
6. Convert year strings to proper dates (2022 -> 2022-01-01)
7. Extract percentages and EMI amounts from Remarks field using pattern matching
8. INFER missing data intelligently (e.g., if no interest rate mentioned but it's an FD, infer a reasonable rate)
9. Only return valid JSON, no markdown formatting
10. BE COMPREHENSIVE - include ALL rows that could be financial items, even if uncertain
11. CREATE categories dynamically - if you see a pattern that doesn't fit standard categories, create appropriate labels
12. For bank names in Entity, create bank balance entries
13. For property-related entities (even if not explicitly "property"), create property entries
14. For any entity with dates and amounts, consider if it could be an investment or loan

REMEMBER: Your goal is to TRANSFORM raw Excel data into a comprehensive financial portfolio. Be creative, be thorough, and use your intelligence to infer and categorize intelligently.`;

  try {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  STEP 1: TESTING OLLAMA CONNECTION                         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    
    // Import and test connection first
    const { testOllamaConnection } = await import("./ollamaService");
    console.log("🔌 Testing Ollama connection...");
    const connectionTest = await testOllamaConnection();
    
    if (!connectionTest.connected) {
      console.error("❌ OLLAMA CONNECTION FAILED!");
      throw new Error(`Cannot connect to Ollama server: ${connectionTest.error}`);
    }
    
    if (!connectionTest.modelAvailable) {
      console.error("❌ OLLAMA MODEL NOT AVAILABLE!");
      throw new Error(`Model not available: ${connectionTest.error}`);
    }
    
    console.log("✅ Ollama connection verified!");
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  STEP 2: CALLING OLLAMA FOR JSON GENERATION                ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`📤 Sending ${dataToAnalyze.length} rows to Ollama`);
    console.log("📋 Sample data row:", JSON.stringify(dataToAnalyze[0], null, 2));
    console.log("⏳ This may take 30-60 seconds depending on data size...");
    console.log("\n");
    
    const parsed = await generateJsonContent(prompt);
    console.log("Raw parsed response from Ollama:", parsed);
    console.log("Parsed JSON structure:", {
      hasInvestments: !!parsed.investments,
      investmentsCount: parsed.investments?.length || 0,
      hasLoans: !!parsed.loans,
      loansCount: parsed.loans?.length || 0,
      hasProperties: !!parsed.properties,
      propertiesCount: parsed.properties?.length || 0,
      hasBankBalances: !!parsed.bankBalances,
      bankBalancesCount: parsed.bankBalances?.length || 0,
    });
    
    if (parsed.investments && parsed.investments.length > 0) {
      console.log("Sample investment from Ollama:", parsed.investments[0]);
    }
    if (parsed.loans && parsed.loans.length > 0) {
      console.log("Sample loan from Ollama:", parsed.loans[0]);
    }
    if (parsed.properties && parsed.properties.length > 0) {
      console.log("Sample property from Ollama:", parsed.properties[0]);
    }
    if (parsed.bankBalances && parsed.bankBalances.length > 0) {
      console.log("Sample bank balance from Ollama:", parsed.bankBalances[0]);
    }

    // Transform to proper format with IDs and timestamps
    const investments: Investment[] = (parsed.investments || []).map(
      (inv: any, index: number) => {
        // Normalize investment type
        let normalizedType: Investment["type"] = "other";
        const typeStr = (inv.type || "").toLowerCase();
        if (typeStr === "ppf" || typeStr === "public provident fund") normalizedType = "ppf";
        else if (typeStr === "fd" || typeStr === "fixed deposit") normalizedType = "fd";
        else if (typeStr === "mutual-fund" || typeStr === "mutual fund" || typeStr === "mf") normalizedType = "mutual-fund";
        else if (typeStr === "stocks" || typeStr === "equity" || typeStr === "shares") normalizedType = "stocks";
        else if (typeStr === "bonds" || typeStr === "debenture") normalizedType = "bonds";
        else if (typeStr === "bank-deposit" || typeStr === "bank deposit" || typeStr === "pf" || typeStr === "epf") normalizedType = "fd"; // Treat bank deposits and PF as FD type

        return {
          id: `inv-ai-${Date.now()}-${index}`,
          name: inv.name || "Unknown Investment",
          amount: parseFloat(String(inv.amount).replace(/,/g, "")) || 0,
          type: normalizedType,
          startDate: inv.startDate || new Date().toISOString(),
          maturityDate: inv.maturityDate || undefined,
          endDate: undefined,
          interestRate: inv.interestRate ? parseFloat(String(inv.interestRate).replace(/,/g, "")) : undefined,
          description: `Auto-extracted and categorized from Excel`,
          status: (inv.status || "active") as Investment["status"],
          isPublished: false, // All Excel-imported items start as draft
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    );

    const loans: Loan[] = (parsed.loans || []).map((loan: any, index: number) => {
      // Normalize loan type
      let normalizedType: Loan["type"] = "other";
      const typeStr = (loan.type || "").toLowerCase();
      if (typeStr.includes("home") || typeStr.includes("house") || typeStr.includes("housing")) normalizedType = "home-loan";
      else if (typeStr.includes("car") || typeStr.includes("vehicle") || typeStr.includes("auto")) normalizedType = "car-loan";
      else if (typeStr.includes("personal")) normalizedType = "personal-loan";
      else if (typeStr.includes("education") || typeStr.includes("student")) normalizedType = "education-loan";
      else if (typeStr.includes("business") || typeStr.includes("commercial")) normalizedType = "other"; // Map to other for now

      return {
        id: `loan-ai-${Date.now()}-${index}`,
        name: loan.name || "Unknown Loan",
        type: normalizedType,
        principalAmount: parseFloat(String(loan.principalAmount).replace(/,/g, "")) || 0,
        outstandingAmount: parseFloat(String(loan.outstandingAmount).replace(/,/g, "")) || parseFloat(String(loan.principalAmount).replace(/,/g, "")) || 0,
        interestRate: parseFloat(String(loan.interestRate).replace(/,/g, "")) || 0,
        startDate: loan.startDate || new Date().toISOString(),
        endDate: undefined,
        emiAmount: parseFloat(String(loan.emiAmount).replace(/,/g, "")) || 0,
        emiDate: loan.emiDate || 1,
        tenureMonths: parseInt(String(loan.tenureMonths)) || 0,
        description: `Auto-extracted and categorized from Excel`,
        status: (loan.status || "active") as Loan["status"],
        isPublished: false, // All Excel-imported items start as draft
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const properties: Property[] = (parsed.properties || []).map(
      (prop: any, index: number) => {
        // Normalize property type
        let normalizedType: Property["type"] = "other";
        const typeStr = (prop.type || "").toLowerCase();
        if (typeStr === "house" || typeStr === "home") normalizedType = "house";
        else if (typeStr === "plot" || typeStr === "land") normalizedType = "plot";
        else if (typeStr === "apartment" || typeStr === "flat") normalizedType = "apartment";
        else if (typeStr === "commercial" || typeStr === "shop" || typeStr === "office") normalizedType = "commercial";
        else if (typeStr === "land") normalizedType = "land";

        return {
          id: `prop-ai-${Date.now()}-${index}`,
          name: prop.name || "Unknown Property",
          type: normalizedType,
          purchasePrice: parseFloat(String(prop.purchasePrice).replace(/,/g, "")) || 0,
          currentValue: prop.currentValue ? parseFloat(String(prop.currentValue).replace(/,/g, "")) : undefined,
          purchaseDate: prop.purchaseDate || new Date().toISOString(),
          location: prop.location || "Unknown",
          description: `Auto-extracted and categorized from Excel`,
          status: (prop.status || "owned") as Property["status"],
          isPublished: false, // All Excel-imported items start as draft
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    );

    // Process bank balances
    const bankBalances: BankBalance[] = (parsed.bankBalances || []).map(
      (bb: any, index: number) => {
        return {
          id: `bb-ai-${Date.now()}-${index}`,
          bankName: bb.bankName || bb.name || "Unknown Bank",
          accountNumber: bb.accountNumber || "",
          accountType: (bb.accountType || "savings") as BankBalance["accountType"],
          balance: parseFloat(String(bb.balance).replace(/,/g, "")) || 0,
          currency: bb.currency || "INR",
          lastUpdated: bb.lastUpdated || new Date().toISOString(),
          description: `Auto-extracted from Excel`,
          status: (bb.status || "active") as BankBalance["status"],
          isPublished: false, // All Excel-imported items start as draft
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    );

    console.log(`Successfully extracted: ${investments.length} investments, ${loans.length} loans, ${properties.length} properties, ${bankBalances.length} bank balances`);

    // Learn from AI categorization for continuous improvement
    investments.forEach((inv) => {
      learnFromCategorization(inv.name, inv.type, "investment");
    });

    loans.forEach((loan) => {
      learnFromCategorization(loan.name, loan.type, "loan");
    });

    properties.forEach((prop) => {
      learnFromCategorization(prop.name, prop.type, "property");
    });

    // Final validation - ensure we have some data
    const totalItems = investments.length + loans.length + properties.length + bankBalances.length;
    if (totalItems === 0) {
      console.warn("⚠️ WARNING: AI analysis returned zero items. This might indicate:");
      console.warn("   1. The data doesn't match expected patterns");
      console.warn("   2. The AI couldn't categorize the data");
      console.warn("   3. There was an issue with JSON parsing");
      console.warn("   Check the Ollama logs above for details.");
    }

    return { investments, loans, properties, bankBalances };
  } catch (error: any) {
    console.error("==========================================");
    console.error("❌ CRITICAL ERROR analyzing Excel data with Ollama");
    console.error("==========================================");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    
    // Log the full error object for debugging
    if (error?.response) {
      console.error("Ollama API response error:", error.response);
    }
    if (error?.cause) {
      console.error("Error cause:", error.cause);
    }
    
    console.error("==========================================");
    
    // Re-throw the error so the caller knows something went wrong
    // The file upload route will handle it appropriately
    throw new Error(`AI analysis failed: ${error?.message || "Unknown error"}. Check server logs for details.`);
  }
}


