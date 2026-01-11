import { generateJsonContent } from './geminiJsonService';
import { generateJsonContent as generateJsonContentOllama } from './ollamaService';
import { getModelForUseCase } from './aiModelService';
import { GmailEmail } from './gmailService';
import { cleanEmailText } from './emailParserService';
import { getEnabledPatterns } from './loanEmailPatternService';

export interface ExtractedQuarterlyLoanData {
  accountNumber: string;
  loanName: string;
  loanType?: 'home-loan' | 'car-loan' | 'personal-loan' | 'education-loan' | 'other';
  outstandingAmount: number;
  principalPaid: number; // Principal paid in this quarter
  interestPaid: number; // Interest paid in this quarter
  emiAmount: number;
  remainingTenureMonths: number;
  interestRate: number;
  quarterEndDate: string; // YYYY-MM-DD format
  reductionType?: 'amount' | 'tenure'; // Whether loan is reducing amount or tenure
  confidence: number;
}

export interface ExtractedRateChange {
  accountNumber: string;
  loanName: string;
  oldRate: number;
  newRate: number;
  effectiveDate: string; // YYYY-MM-DD format
  confidence: number;
}

export interface LoanEmailDetectionResult {
  isLoanEmail: boolean;
  emailType: 'quarterly-summary' | 'interest-rate-change' | 'other';
  confidence: number;
}

/**
 * Detect if email is loan-related
 */
export async function detectLoanEmail(email: GmailEmail): Promise<LoanEmailDetectionResult> {
  const cleanedText = cleanEmailText(email);
  const subject = email.subject || '';

  // Get dynamic patterns from service
  const quarterlyPatterns = getEnabledPatterns('quarterly-summary').map(p => p.title.toLowerCase());
  const rateChangePatterns = getEnabledPatterns('interest-rate-change').map(p => p.title.toLowerCase());
  const otherPatterns = getEnabledPatterns('other').map(p => p.title.toLowerCase());
  
  // Add fallback patterns if no dynamic patterns configured
  const fallbackQuarterlyPatterns = [
    'quarterly loan summary',
    'loan summary',
    'loan statement',
    'property loan',
    'home loan',
  ];
  const fallbackRateChangePatterns = [
    'interest rate',
    'rate change',
    'loan interest',
    'rate update',
  ];
  
  const allQuarterlyPatterns = quarterlyPatterns.length > 0 ? quarterlyPatterns : fallbackQuarterlyPatterns;
  const allRateChangePatterns = rateChangePatterns.length > 0 ? rateChangePatterns : fallbackRateChangePatterns;
  const allOtherPatterns = otherPatterns;

  const lowerSubject = subject.toLowerCase();
  const lowerText = cleanedText.toLowerCase();

  // Pattern-based detection using dynamic patterns
  // For rate change, check if key words match (more flexible)
  const isQuarterly = allQuarterlyPatterns.some(pattern => 
    lowerSubject.includes(pattern) || lowerText.includes(pattern)
  );
  const isRateChange = allRateChangePatterns.some(pattern => {
    // Exact match
    if (lowerSubject.includes(pattern) || lowerText.includes(pattern)) {
      return true;
    }
    // Flexible match: check if key words from pattern are present
    const patternWords = pattern.split(/\s+/).filter(w => w.length > 3);
    const hasKeyWords = patternWords.every(word => 
      lowerSubject.includes(word) || lowerText.includes(word)
    );
    // Also check for rate change keywords
    const rateChangeKeywords = ['interest rate', 'rate change', 'rate reduced', 'rate increased', 'rate revised'];
    const hasRateKeywords = rateChangeKeywords.some(keyword => 
      lowerSubject.includes(keyword) || lowerText.includes(keyword)
    );
    return hasKeyWords || hasRateKeywords;
  });
  const isOther = allOtherPatterns.some(pattern => 
    lowerSubject.includes(pattern) || lowerText.includes(pattern)
  );

  if (isQuarterly || isRateChange || isOther) {
    return {
      isLoanEmail: true,
      emailType: isQuarterly ? 'quarterly-summary' : isRateChange ? 'interest-rate-change' : 'other',
      confidence: 0.8,
    };
  }

  // AI-based detection for more complex cases
  if (cleanedText.length < 20) {
    return { isLoanEmail: false, emailType: 'other', confidence: 0 };
  }

  const prompt = `Analyze this email and determine if it contains loan-related information.

Email Subject: ${subject}
Email Content: ${cleanedText.substring(0, 1000)}

Determine if this is:
1. A quarterly loan summary (contains outstanding balance, principal paid, interest paid, EMI details)
2. An interest rate change notification (contains old rate, new rate, effective date)
3. Other loan-related email
4. Not a loan email

Return ONLY a JSON object with:
{
  "isLoanEmail": true or false,
  "emailType": "quarterly-summary" | "interest-rate-change" | "other",
  "confidence": number between 0 and 1
}`;

  try {
    const { provider } = getModelForUseCase('json');
    const systemPrompt = `You are a financial email analyzer. Analyze emails and determine if they contain loan information. Return ONLY valid JSON with "isLoanEmail" (boolean), "emailType" (string), and "confidence" (number 0-1) fields.`;

    const response = provider === 'gemini'
      ? await generateJsonContent(prompt, systemPrompt)
      : await generateJsonContentOllama(prompt, systemPrompt);

    return {
      isLoanEmail: response.isLoanEmail === true,
      emailType: response.emailType || 'other',
      confidence: response.confidence || 0,
    };
  } catch (error) {
    console.error('[Loan Email Parser] Error detecting loan email:', error);
    // Fallback: check for keywords
    const keywords = ['loan', 'emi', 'outstanding', 'principal', 'interest rate', 'tenure'];
    const hasKeywords = keywords.some(keyword => lowerText.includes(keyword));

    return {
      isLoanEmail: hasKeywords,
      emailType: hasKeywords ? 'other' : 'other',
      confidence: hasKeywords ? 0.5 : 0,
    };
  }
}

/**
 * Extract quarterly loan summary data from email
 */
export async function extractQuarterlyLoanData(
  email: GmailEmail,
  referenceData?: Record<string, string | number>
): Promise<ExtractedQuarterlyLoanData | null> {
  const cleanedText = cleanEmailText(email);
  const subject = email.subject || '';

  // Build reference data context if available
  let referenceDataContext = '';
  if (referenceData && Object.keys(referenceData).length > 0) {
    const referenceEntries = Object.entries(referenceData)
      .map(([key, value]) => `- ${key}: ${typeof value === 'number' ? value.toLocaleString('en-IN') : value}`)
      .join('\n');
    referenceDataContext = `\n\n⚠️ CRITICAL: REFERENCE DATA - ANALYZE THIS FIRST BEFORE PROCESSING EMAIL:
${referenceEntries}

IMPORTANT INSTRUCTIONS FOR USING REFERENCE DATA:
1. ANALYZE REFERENCE DATA FIRST - Use these values as the primary source for calculations
2. If "Disbursement Amount" is in reference data, use it to calculate outstanding amount:
   outstandingAmount = Disbursement Amount - Principal recovered till date (from email)
3. Cross-validate email values against reference data
4. If email value conflicts with reference data, prefer reference data for calculations
5. Use reference data to fill missing information from email
6. All calculations should prioritize reference data values

Example: If reference data has "Disbursement Amount: 2,311,386" and email shows "Principal recovered till date: 160,179", then:
outstandingAmount = 2311386 - 160179 = 2,151,207

`;
  }

  const prompt = `Extract loan information from this quarterly loan summary email. The email may contain a structured table with loan details.${referenceDataContext}

Email Subject: ${subject}
Email Content: ${cleanedText}

CRITICAL EXTRACTION RULES:

1. accountNumber: Extract from "Loan No:", "A/C No:", "Account No:", "Loan A/C No:" or similar. May be partially masked (e.g., "XX4325119")

2. loanName: Extract from subject or email content. Common patterns: "Property Loan", "Home Loan", "House Loan", "Housing Loan"

3. loanType: Determine from loan name or context. Must be one of: "home-loan", "car-loan", "personal-loan", "education-loan", "other"

4. outstandingAmount: CRITICAL - Calculate correctly (PRIORITIZE REFERENCE DATA):
   - IF "Disbursement Amount" is in reference data:
     outstandingAmount = Disbursement Amount (from reference data) - Principal recovered till date (from email)
     Example: If reference data has "Disbursement Amount: 23,11,386" and email shows "Principal recovered: 160,179":
     outstandingAmount = 2311386 - 160179 = 2,151,207
   - IF "Disbursement Amount" is NOT in reference data, but email shows "Sanctioned Amount":
     outstandingAmount = Sanctioned Amount - Principal recovered till date
     Example: 2,500,000 - 160,179 = 2,339,821
   - If "Outstanding Amount" or "Balance" is directly shown in email, use that value
   - ALWAYS prioritize Disbursement Amount from reference data over Sanctioned Amount from email
   - Remove all commas and currency symbols before calculating

5. principalPaid: This is CUMULATIVE "Principal amount recovered till date" (NOT quarterly amount)
   - Look for: "Principal amount recovered till date", "Principal recovered", "Principal Paid Till Date"
   - This is the TOTAL principal paid since loan start, not just this quarter
   - Remove commas and currency symbols

6. interestPaid: This is CUMULATIVE "Interest amount recovered till date" (NOT quarterly amount)
   - Look for: "Interest amount recovered till date", "Interest recovered", "Interest Paid Till Date"
   - This is the TOTAL interest paid since loan start, not just this quarter
   - Remove commas and currency symbols

7. emiAmount: Current EMI amount
   - Look for: "Current EMI Amount", "EMI Amount", "Monthly EMI", "Total Pre-EMI/EMI amount due"
   - Remove commas and currency symbols

8. remainingTenureMonths: Remaining tenure in months
   - Look for: "Balance Tenure (No of EMI's Left)", "No of EMI's Left", "Remaining Tenure", "EMI's Left"
   - Extract the number only (e.g., "101" from "Balance Tenure (No of EMI's Left)*: 101")

9. interestRate: Interest rate as a number (e.g., 7.45 for 7.45%)
   - Look for: "Interest Rate (p.a)", "Rate", "Interest Rate"
   - Extract percentage value (e.g., "7.45%" -> 7.45)

10. quarterEndDate: Effective date of the loan summary
    - Look for: "Loan Summary as of", "as of", "Effective as of", "Date:"
    - Parse dates like "30-Sep-25" -> "2025-09-30", "30-09-2025" -> "2025-09-30"
    - If year is 2-digit (e.g., "25"), assume 20XX (e.g., "25" -> "2025")
    - Return in YYYY-MM-DD format

11. reductionType: "amount" if loan reduces outstanding amount, "tenure" if loan reduces tenure, or null if unclear

12. confidence: Your confidence in the extraction (0-1)

EXAMPLE FROM EMAIL TABLE:
If email shows:
- Sanctioned Amount (Rs): 2,500,000
- Principal amount recovered till date (Rs): 160,179
- Interest amount recovered till date (Rs): 1,102,722
- Current EMI Amount (Rs): 28,597
- Balance Tenure (No of EMI's Left)*: 101
- Interest Rate (p.a): 7.45%
- Loan Summary as of: 30-Sep-25

Then extract:
- outstandingAmount: 2500000 - 160179 = 2339821
- principalPaid: 160179 (cumulative)
- interestPaid: 1102722 (cumulative)
- emiAmount: 28597
- remainingTenureMonths: 101
- interestRate: 7.45
- quarterEndDate: 2025-09-30

Return ONLY a valid JSON object with the extracted data.`;

  try {
    const { provider } = getModelForUseCase('json');
    const systemPrompt = `You are an expert at extracting structured loan data from emails. You must return ONLY valid JSON. No markdown, no explanations, just JSON. The JSON must include: accountNumber (string), loanName (string), loanType (one of: "home-loan", "car-loan", "personal-loan", "education-loan", "other"), outstandingAmount (number), principalPaid (number), interestPaid (number), emiAmount (number), remainingTenureMonths (number), interestRate (number), quarterEndDate (YYYY-MM-DD), reductionType ("amount" | "tenure" | null), confidence (number 0-1).`;

    const response = provider === 'gemini'
      ? await generateJsonContent(prompt, systemPrompt)
      : await generateJsonContentOllama(prompt, systemPrompt);

    // Validate and normalize the response
    const extracted: ExtractedQuarterlyLoanData = {
      accountNumber: String(response.accountNumber || '').trim(),
      loanName: response.loanName || subject || 'Loan from Email',
      loanType: normalizeLoanType(response.loanType),
      outstandingAmount: parseFloat(String(response.outstandingAmount || 0).replace(/[^0-9.]/g, '')) || 0,
      principalPaid: parseFloat(String(response.principalPaid || 0).replace(/[^0-9.]/g, '')) || 0,
      interestPaid: parseFloat(String(response.interestPaid || 0).replace(/[^0-9.]/g, '')) || 0,
      emiAmount: parseFloat(String(response.emiAmount || 0).replace(/[^0-9.]/g, '')) || 0,
      remainingTenureMonths: parseInt(String(response.remainingTenureMonths || 0)) || 0,
      interestRate: parseFloat(String(response.interestRate || 0).replace(/[^0-9.]/g, '')) || 0,
      quarterEndDate: response.quarterEndDate || new Date().toISOString().split('T')[0],
      reductionType: response.reductionType === 'amount' || response.reductionType === 'tenure' 
        ? response.reductionType 
        : undefined,
      confidence: Math.min(Math.max(response.confidence || 0.5, 0), 1),
    };

    // Post-process: ALWAYS recalculate outstanding amount using Disbursement Amount from reference data
    // This MUST override any AI-extracted value
    const principalRecoveredMatch = cleanedText.match(/principal\s+amount\s+recovered\s+till\s+date[:\s]+(?:rs\.?|₹)?\s*([\d,]+)/i);
    
    if (principalRecoveredMatch) {
      const principalRecovered = parseFloat(principalRecoveredMatch[1].replace(/,/g, ''));
      let baseAmount: number | null = null;
      let source = '';
      
      // CRITICAL: First priority - Use Disbursement Amount from reference data
      if (referenceData && Object.keys(referenceData).length > 0) {
        console.log('[Loan Email Parser] Checking reference data for Disbursement Amount. Available keys:', Object.keys(referenceData));
        
        // Try different key variations (case-insensitive search)
        const disbursementKeys = ['Disbursement Amount', 'DisbursementAmount', 'disbursement amount', 'disbursementAmount', 'Disbursement'];
        for (const key of disbursementKeys) {
          // Direct key match
          let disbursementAmount = referenceData[key];
          
          // If not found, try case-insensitive search
          if (disbursementAmount === undefined) {
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(referenceData).find(k => k.toLowerCase() === lowerKey);
            if (foundKey) {
              disbursementAmount = referenceData[foundKey];
              console.log(`[Loan Email Parser] Found Disbursement Amount with key: "${foundKey}"`);
            }
          }
          
          if (disbursementAmount !== undefined && disbursementAmount !== null) {
            baseAmount = typeof disbursementAmount === 'number' 
              ? disbursementAmount 
              : parseFloat(String(disbursementAmount).replace(/[^0-9.]/g, ''));
            if (baseAmount > 0) {
              source = 'Disbursement Amount (reference data)';
              console.log(`[Loan Email Parser] ✅ Found Disbursement Amount in reference data: ${baseAmount}`);
              break;
            }
          }
        }
        
        if (!baseAmount) {
          console.warn('[Loan Email Parser] ❌ Disbursement Amount not found in reference data. Available keys:', Object.keys(referenceData));
        }
      } else {
        console.warn('[Loan Email Parser] ❌ No reference data provided');
      }
      
      // Second priority: Use Sanctioned Amount from email ONLY if Disbursement Amount not available
      if (baseAmount === null || baseAmount <= 0) {
        const sanctionedMatch = cleanedText.match(/sanctioned\s+amount[:\s]+(?:rs\.?|₹)?\s*([\d,]+)/i);
        if (sanctionedMatch) {
          baseAmount = parseFloat(sanctionedMatch[1].replace(/,/g, ''));
          source = 'Sanctioned Amount (email)';
          console.log(`[Loan Email Parser] Using Sanctioned Amount as fallback: ${baseAmount}`);
        }
      }
      
      // Calculate outstanding amount - ALWAYS override if we have Disbursement Amount
      if (baseAmount !== null && baseAmount > 0 && principalRecovered > 0) {
        const calculatedOutstanding = baseAmount - principalRecovered;
        
        if (calculatedOutstanding > 0) {
          if (source.includes('Disbursement Amount')) {
            // FORCE override with Disbursement Amount calculation
            console.log(`[Loan Email Parser] 🔄 FORCING outstanding recalculation using ${source}`);
            console.log(`[Loan Email Parser]   Old value: ${extracted.outstandingAmount}`);
            console.log(`[Loan Email Parser]   New value: ${calculatedOutstanding}`);
            console.log(`[Loan Email Parser]   Calculation: ${baseAmount} - ${principalRecovered} = ${calculatedOutstanding}`);
            extracted.outstandingAmount = calculatedOutstanding;
          } else {
            // For Sanctioned Amount, only update if significantly different
            const difference = Math.abs(calculatedOutstanding - extracted.outstandingAmount);
            const tolerance = extracted.outstandingAmount * 0.1; // 10% tolerance
            if (difference > tolerance) {
              console.log(`[Loan Email Parser] Recalculating outstanding using ${source}: ${extracted.outstandingAmount} -> ${calculatedOutstanding}`);
              extracted.outstandingAmount = calculatedOutstanding;
            }
          }
        } else {
          console.warn(`[Loan Email Parser] Calculated outstanding is negative or zero: ${calculatedOutstanding}`);
        }
      } else {
        console.warn(`[Loan Email Parser] Cannot calculate outstanding: baseAmount=${baseAmount}, principalRecovered=${principalRecovered}`);
      }
    } else {
      console.warn('[Loan Email Parser] Could not find "Principal amount recovered till date" in email text');
    }

    // Validate required fields
    if (!extracted.accountNumber || extracted.outstandingAmount <= 0) {
      console.warn('[Loan Email Parser] Invalid extracted quarterly data:', extracted);
      return null;
    }

    return extracted;
  } catch (error) {
    console.error('[Loan Email Parser] Error extracting quarterly loan data:', error);
    return null;
  }
}

/**
 * Extract interest rate change data from email
 */
export async function extractInterestRateChange(email: GmailEmail): Promise<ExtractedRateChange | null> {
  const cleanedText = cleanEmailText(email);
  const subject = email.subject || '';

  const prompt = `Extract interest rate change information from this email.

Email Subject: ${subject}
Email Content: ${cleanedText}

CRITICAL EXTRACTION RULES:

1. accountNumber: Loan account number (e.g., "644325119", "A/C No: 123456", "Loan A/C No 644325119")
   - Extract from various formats: "A/C No:", "Account No:", "Loan A/C No", "Loan Account Number"
   - May be partially masked (e.g., "XX4325119")

2. loanName: Loan name/description (e.g., "Property Loan", "Home Loan", "House Loan")

3. oldRate: Previous interest rate as a NUMBER (e.g., 7.45 for 7.45%, 8.25 for 8.25%)
   - Extract the OLD/PREVIOUS rate that is being changed FROM
   - Look for phrases like "from 7.45%", "previous rate", "current rate", "existing rate", "earlier rate"
   - The rate can be INCREASED or DECREASED - extract the rate that was BEFORE the change
   - Must be a number (e.g., 7.45, 8.25, 9.0)

4. newRate: New interest rate as a NUMBER (e.g., 8.25 for 8.25%, 7.45 for 7.45%)
   - Extract the NEW rate that is being changed TO
   - Look for phrases like "to 8.25%", "new rate", "revised rate", "updated rate", "revised to"
   - The rate can be HIGHER or LOWER than the old rate (both increases and decreases are valid)
   - Must be a number (e.g., 8.25, 7.45, 9.0, 10.5)
   - CRITICAL: Extract the EXACT rate value, including decimals (e.g., 8.25 not 8.2 or 8, 7.45 not 7.4 or 7)
   - IMPORTANT: If email says "rate reduced" or "rate decreased", the newRate will be LOWER than oldRate
   - IMPORTANT: If email says "rate increased" or "rate revised upward", the newRate will be HIGHER than oldRate

5. effectiveDate: Effective date of rate change in YYYY-MM-DD format
   - Look for "effective from", "effective date", "with effect from", "w.e.f.", "effective"
   - Parse dates in various formats (DD-MM-YYYY, DD/MM/YYYY, Month DD YYYY, etc.)
   - Convert to YYYY-MM-DD format

6. confidence: Your confidence in the extraction (0-1)

EXAMPLES:
- If email says "Interest rate changed from 7.45% to 8.25%", extract: oldRate: 7.45, newRate: 8.25
- If email says "Interest rate reduced from 8.25% to 7.45%", extract: oldRate: 8.25, newRate: 7.45
- If email says "New rate: 8.25% p.a. (previous: 7.45%)", extract: oldRate: 7.45, newRate: 8.25
- If email says "Rate reduced to 7.45% from 8.25%", extract: oldRate: 8.25, newRate: 7.45
- If email says "Rate updated to 8.25%", you may need to infer oldRate from context or use 0 if not mentioned

Return ONLY a valid JSON object with the extracted data.`;

  try {
    const { provider } = getModelForUseCase('json');
    const systemPrompt = `You are an expert at extracting interest rate change data from emails. You must return ONLY valid JSON. No markdown, no explanations, just JSON. The JSON must include: accountNumber (string), loanName (string), oldRate (number), newRate (number), effectiveDate (YYYY-MM-DD), confidence (number 0-1).`;

    const response = provider === 'gemini'
      ? await generateJsonContent(prompt, systemPrompt)
      : await generateJsonContentOllama(prompt, systemPrompt);

    // Validate and normalize the response
    const extracted: ExtractedRateChange = {
      accountNumber: String(response.accountNumber || '').trim(),
      loanName: response.loanName || subject || 'Loan from Email',
      oldRate: parseFloat(String(response.oldRate || 0).replace(/[^0-9.]/g, '')) || 0,
      newRate: parseFloat(String(response.newRate || 0).replace(/[^0-9.]/g, '')) || 0,
      effectiveDate: response.effectiveDate || new Date().toISOString().split('T')[0],
      confidence: Math.min(Math.max(response.confidence || 0.5, 0), 1),
    };

    // Log extracted data for debugging
    console.log('[Loan Email Parser] Extracted interest rate change:', {
      accountNumber: extracted.accountNumber,
      loanName: extracted.loanName,
      oldRate: extracted.oldRate,
      newRate: extracted.newRate,
      effectiveDate: extracted.effectiveDate,
      confidence: extracted.confidence,
    });

    // Validate required fields
    if (!extracted.accountNumber || extracted.newRate <= 0) {
      console.warn('[Loan Email Parser] Invalid extracted rate change data:', extracted);
      return null;
    }

    // Validate that newRate is reasonable (between 0.1% and 30%)
    if (extracted.newRate < 0.1 || extracted.newRate > 30) {
      console.warn('[Loan Email Parser] New rate seems unreasonable:', extracted.newRate);
    }

    return extracted;
  } catch (error) {
    console.error('[Loan Email Parser] Error extracting interest rate change:', error);
    return null;
  }
}

/**
 * Normalize loan type
 */
function normalizeLoanType(type: string | undefined): 'home-loan' | 'car-loan' | 'personal-loan' | 'education-loan' | 'other' {
  if (!type) return 'other';
  const typeStr = type.toLowerCase();
  if (typeStr.includes('home') || typeStr.includes('house') || typeStr.includes('housing') || typeStr.includes('property')) {
    return 'home-loan';
  }
  if (typeStr.includes('car') || typeStr.includes('vehicle') || typeStr.includes('auto')) {
    return 'car-loan';
  }
  if (typeStr.includes('personal')) {
    return 'personal-loan';
  }
  if (typeStr.includes('education') || typeStr.includes('student')) {
    return 'education-loan';
  }
  return 'other';
}
