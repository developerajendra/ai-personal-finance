import { generateJsonContent, generateTextContent } from './geminiJsonService';
import { generateJsonContent as generateJsonContentOllama } from './ollamaService';
import { getModelForUseCase } from './aiModelService';
import { GmailEmail } from './gmailService';
import { Investment } from '@/core/types';

export interface ExtractedInvestment {
  name: string;
  amount: number;
  type: Investment['type'];
  startDate?: string;
  maturityDate?: string;
  interestRate?: number;
  description?: string;
  confidence: number;
}

export interface EmailAnalysisResult {
  isInvestmentEmail: boolean;
  confidence: number;
  extractedData?: ExtractedInvestment;
  error?: string;
}

/**
 * Clean and normalize email text
 */
export function cleanEmailText(email: GmailEmail): string {
  // Use plain text body, fallback to HTML stripped
  let text = email.body || '';
  
  // Remove email signatures (common patterns)
  text = text.replace(/--\s*[\s\S]*$/, ''); // Remove after --
  text = text.replace(/Sent from.*$/m, ''); // Remove "Sent from" lines
  text = text.replace(/Best regards.*$/is, ''); // Remove closing signatures
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Detect if email contains investment information using AI
 */
export async function detectInvestmentEmail(email: GmailEmail): Promise<{
  isInvestmentEmail: boolean;
  confidence: number;
}> {
  const cleanedText = cleanEmailText(email);
  
  if (cleanedText.length < 20) {
    return { isInvestmentEmail: false, confidence: 0 };
  }

  const prompt = `Analyze this email and determine if it contains information about a financial investment (like FD, PPF, Mutual Fund, Stocks, Bonds, etc.).

Email Subject: ${email.subject}
Email Content: ${cleanedText.substring(0, 1000)}

Return ONLY a JSON object with:
{
  "isInvestmentEmail": true or false,
  "confidence": number between 0 and 1
}`;

  try {
    const { provider } = getModelForUseCase('json');
    const systemPrompt = `You are a financial email analyzer. Analyze emails and determine if they contain investment information. Return ONLY valid JSON with "isInvestmentEmail" (boolean) and "confidence" (number 0-1) fields.`;
    
    // Use appropriate provider based on configuration
    const response = provider === 'gemini'
      ? await generateJsonContent(prompt, systemPrompt)
      : await generateJsonContentOllama(prompt, systemPrompt);
    
    return {
      isInvestmentEmail: response.isInvestmentEmail === true,
      confidence: response.confidence || 0,
    };
  } catch (error) {
    console.error('[Email Parser] Error detecting investment email:', error);
    // Fallback: check for keywords
    const keywords = ['investment', 'fd', 'ppf', 'mutual fund', 'stock', 'bond', 'deposit', 'sip', 'nav'];
    const lowerText = cleanedText.toLowerCase();
    const hasKeywords = keywords.some(keyword => lowerText.includes(keyword));
    
    return {
      isInvestmentEmail: hasKeywords,
      confidence: hasKeywords ? 0.5 : 0,
    };
  }
}

/**
 * Extract investment data from email using AI
 */
export async function extractInvestmentData(email: GmailEmail): Promise<ExtractedInvestment | null> {
  const cleanedText = cleanEmailText(email);
  
  const prompt = `Extract investment information from this email. Parse both natural language and structured formats.

Email Subject: ${email.subject}
Email Content: ${cleanedText}

Extract the following information:
- name: Investment name (e.g., "HDFC Fixed Deposit", "SBI PPF", "Reliance Mutual Fund")
- amount: Investment amount (number only, no currency symbols)
- type: Investment type - must be one of: "ppf", "fd", "mutual-fund", "stocks", "bonds", "other"
- startDate: Start date in YYYY-MM-DD format (if mentioned, otherwise use today's date: ${new Date().toISOString().split('T')[0]})
- maturityDate: Maturity date in YYYY-MM-DD format (if mentioned)
- interestRate: Interest rate as a number (if mentioned, e.g., 7.5 for 7.5%)
- description: Additional notes or context from the email
- confidence: Your confidence in the extraction (0-1)

Examples of natural language:
- "I invested 50000 in HDFC FD at 7% interest, started today"
- "Added 1 lakh to my PPF account"
- "Bought 100 shares of Reliance at 2500"

Examples of structured format:
- Name: HDFC FD, Amount: 50000, Type: FD, Interest: 7%

Return ONLY a valid JSON object with the extracted data. If information is missing, use reasonable defaults or leave undefined.`;

  try {
    const { provider } = getModelForUseCase('json');
    const systemPrompt = `You are an expert at extracting structured financial data from emails. You must return ONLY valid JSON. No markdown, no explanations, just JSON. The JSON must include: name (string), amount (number), type (one of: "ppf", "fd", "mutual-fund", "stocks", "bonds", "other"), startDate (YYYY-MM-DD), maturityDate (YYYY-MM-DD or null), interestRate (number or null), description (string or null), confidence (number 0-1).`;
    
    // Use appropriate provider based on configuration
    const response = provider === 'gemini'
      ? await generateJsonContent(prompt, systemPrompt)
      : await generateJsonContentOllama(prompt, systemPrompt);

    // Validate and normalize the response
    const extracted: ExtractedInvestment = {
      name: response.name || email.subject || 'Investment from Email',
      amount: parseFloat(String(response.amount || 0).replace(/[^0-9.]/g, '')) || 0,
      type: normalizeInvestmentType(response.type),
      startDate: response.startDate || new Date().toISOString().split('T')[0],
      maturityDate: response.maturityDate || undefined,
      interestRate: response.interestRate ? parseFloat(String(response.interestRate)) : undefined,
      description: response.description || `Extracted from email: ${email.subject}`,
      confidence: Math.min(Math.max(response.confidence || 0.5, 0), 1),
    };

    // Validate required fields
    if (!extracted.name || extracted.amount <= 0) {
      console.warn('[Email Parser] Invalid extracted data:', extracted);
      return null;
    }

    return extracted;
  } catch (error) {
    console.error('[Email Parser] Error extracting investment data:', error);
    return null;
  }
}

/**
 * Normalize investment type
 */
function normalizeInvestmentType(type: string | undefined): Investment['type'] {
  if (!type) return 'other';
  
  const lowerType = type.toLowerCase().trim();
  
  if (lowerType === 'ppf' || lowerType === 'public provident fund') return 'ppf';
  if (lowerType === 'fd' || lowerType === 'fixed deposit' || lowerType === 'term deposit') return 'fd';
  if (lowerType === 'mutual-fund' || lowerType === 'mutual fund' || lowerType === 'mf' || lowerType === 'sip') return 'mutual-fund';
  if (lowerType === 'stocks' || lowerType === 'stock' || lowerType === 'equity' || lowerType === 'shares') return 'stocks';
  if (lowerType === 'bonds' || lowerType === 'bond' || lowerType === 'debenture') return 'bonds';
  
  return 'other';
}

/**
 * Validate extracted investment data
 */
export function validateInvestmentData(data: ExtractedInvestment): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Investment name is required');
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Investment amount must be greater than 0');
  }

  if (data.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
    errors.push('Start date must be in YYYY-MM-DD format');
  }

  if (data.maturityDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.maturityDate)) {
    errors.push('Maturity date must be in YYYY-MM-DD format');
  }

  if (data.interestRate !== undefined && (data.interestRate < 0 || data.interestRate > 100)) {
    errors.push('Interest rate must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Complete email analysis pipeline
 */
export async function analyzeEmail(email: GmailEmail): Promise<EmailAnalysisResult> {
  try {
    // Step 1: Detect if it's an investment email
    const detection = await detectInvestmentEmail(email);
    
    if (!detection.isInvestmentEmail || detection.confidence < 0.3) {
      return {
        isInvestmentEmail: false,
        confidence: detection.confidence,
      };
    }

    // Step 2: Extract investment data
    const extractedData = await extractInvestmentData(email);
    
    if (!extractedData) {
      return {
        isInvestmentEmail: true,
        confidence: detection.confidence,
        error: 'Failed to extract investment data',
      };
    }

    // Step 3: Validate extracted data
    const validation = validateInvestmentData(extractedData);
    
    if (!validation.valid) {
      return {
        isInvestmentEmail: true,
        confidence: detection.confidence,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    return {
      isInvestmentEmail: true,
      confidence: Math.min(detection.confidence, extractedData.confidence),
      extractedData,
    };
  } catch (error: any) {
    console.error('[Email Parser] Error analyzing email:', error);
    return {
      isInvestmentEmail: false,
      confidence: 0,
      error: error.message || 'Unknown error',
    };
  }
}

