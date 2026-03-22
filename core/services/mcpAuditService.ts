/**
 * MCP Audit Service
 * 
 * Connects to the Finance Audit Agent MCP server and calls the
 * audit_finance_calculator tool to audit finance calculator webpages.
 * Also supports in-app financial data auditing using AI reasoning.
 * 
 * Uses stdio transport - spawns the agent as a child process.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

// Path to the finance-audit-agent build output
const AUDIT_AGENT_DIR = path.resolve(process.cwd(), '..', 'finance-audit-agent');
const AUDIT_AGENT_ENTRY = path.join(AUDIT_AGENT_DIR, 'dist', 'index.js');

interface AuditRequest {
  url: string;
  calculator_hint?: string;
}

/**
 * Calls the Finance Audit Agent via MCP to audit a calculator webpage.
 * Spawns the agent process, runs the audit, and returns the result.
 */
export async function callAuditAgent(request: AuditRequest): Promise<string> {
  console.log(`[MCP Client] Starting audit for: ${request.url}`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [AUDIT_AGENT_ENTRY],
    cwd: AUDIT_AGENT_DIR,
    env: {
      ...process.env,
      // Pass through the Gemini API key
      AI_CHAT_API_KEY: process.env.AI_CHAT_API_KEY || '',
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
  });

  const client = new Client(
    {
      name: 'personal-finance-ai-chatbot',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    // Connect to the MCP server
    await client.connect(transport);
    console.log('[MCP Client] Connected to Finance Audit Agent');

    // Call the audit tool with extended timeout (3 minutes)
    // Audit involves: browser launch + page load + mutations + 4 Gemini AI calls
    const result = await client.callTool(
      {
        name: 'audit_finance_calculator',
        arguments: {
          url: request.url,
          ...(request.calculator_hint ? { calculator_hint: request.calculator_hint } : {}),
        },
      },
      undefined,
      {
        timeout: 180000, // 3 minutes
      }
    );

    console.log('[MCP Client] Audit completed');

    // Extract text content from the result
    if (result.content && Array.isArray(result.content)) {
      const textParts = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text);
      return textParts.join('\n');
    }

    return 'Audit completed but no results were returned.';
  } catch (error: any) {
    console.error('[MCP Client] Audit failed:', error);
    throw new Error(`Finance audit failed: ${error.message || 'Unknown error'}`);
  } finally {
    // Always close the connection
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
    console.log('[MCP Client] Connection closed');
  }
}

/**
 * Checks if the Finance Audit Agent MCP server can be reached.
 * Spawns the process, connects, lists tools, and disconnects.
 * Returns connection status and available tools.
 */
export async function checkMcpHealth(): Promise<{ connected: boolean; tools: string[]; error?: string }> {
  console.log('[MCP Client] Health check: connecting to Finance Audit Agent...');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [AUDIT_AGENT_ENTRY],
    cwd: AUDIT_AGENT_DIR,
    env: {
      ...process.env,
      AI_CHAT_API_KEY: process.env.AI_CHAT_API_KEY || '',
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
  });

  const client = new Client(
    { name: 'personal-finance-ai-healthcheck', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    // List available tools to verify the server is functional
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t: any) => t.name);

    console.log(`[MCP Client] Health check passed. Tools: ${toolNames.join(', ')}`);

    return { connected: true, tools: toolNames };
  } catch (error: any) {
    console.error('[MCP Client] Health check failed:', error);
    return { connected: false, tools: [], error: error.message || 'Connection failed' };
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/**
 * Extracts a URL from a message for use in audit-finance agent mode.
 * Used when the user has explicitly selected the audit agent dropdown.
 * Only requires a URL - no keyword detection needed.
 */
export function extractAuditUrl(message: string): AuditRequest | null {
  const urlMatch = message.match(/(https?:\/\/[^\s,)]+)/i);
  if (!urlMatch) return null;

  const url = urlMatch[1];
  const lowerMessage = message.toLowerCase();

  // Try to detect calculator hint from message
  let calculator_hint: string | undefined;
  if (lowerMessage.includes('emi')) calculator_hint = 'emi';
  else if (lowerMessage.includes('sip')) calculator_hint = 'sip';
  else if (lowerMessage.includes('cagr')) calculator_hint = 'cagr';
  else if (lowerMessage.includes('compound interest')) calculator_hint = 'compound_interest';
  else if (lowerMessage.includes('simple interest')) calculator_hint = 'simple_interest';
  else if (lowerMessage.includes('fd') || lowerMessage.includes('fixed deposit')) calculator_hint = 'fd';
  else if (lowerMessage.includes('ppf')) calculator_hint = 'ppf';
  else if (lowerMessage.includes('tax')) calculator_hint = 'tax';
  else if (lowerMessage.includes('loan')) calculator_hint = 'loan';
  else if (lowerMessage.includes('mortgage')) calculator_hint = 'mortgage';

  return { url, calculator_hint };
}

/**
 * Detects if a user message is requesting a finance calculator audit.
 * Returns the URL and optional hint if an audit is being requested.
 * Used in "ask" (default) agent mode for auto-detection.
 */
export function detectAuditIntent(message: string): AuditRequest | null {
  const lowerMessage = message.toLowerCase();

  // Check for audit-related keywords
  const auditKeywords = [
    'audit', 'review', 'check', 'verify', 'validate', 'analyze',
    'test', 'inspect', 'evaluate',
  ];

  const calculatorKeywords = [
    'calculator', 'emi', 'sip', 'cagr', 'compound interest',
    'simple interest', 'fd', 'ppf', 'loan', 'mortgage', 'tax',
    'financial', 'finance',
  ];

  const hasAuditIntent = auditKeywords.some(k => lowerMessage.includes(k));
  const hasCalculatorContext = calculatorKeywords.some(k => lowerMessage.includes(k));

  if (!hasAuditIntent && !hasCalculatorContext) {
    return null;
  }

  // Try to extract URL from the message
  const urlMatch = message.match(/(https?:\/\/[^\s,)]+)/i);
  if (!urlMatch) {
    return null;
  }

  const url = urlMatch[1];

  // Try to detect calculator hint
  let calculator_hint: string | undefined;
  if (lowerMessage.includes('emi')) calculator_hint = 'emi';
  else if (lowerMessage.includes('sip')) calculator_hint = 'sip';
  else if (lowerMessage.includes('cagr')) calculator_hint = 'cagr';
  else if (lowerMessage.includes('compound interest')) calculator_hint = 'compound_interest';
  else if (lowerMessage.includes('simple interest')) calculator_hint = 'simple_interest';
  else if (lowerMessage.includes('fd') || lowerMessage.includes('fixed deposit')) calculator_hint = 'fd';
  else if (lowerMessage.includes('ppf')) calculator_hint = 'ppf';
  else if (lowerMessage.includes('tax')) calculator_hint = 'tax';
  else if (lowerMessage.includes('loan')) calculator_hint = 'loan';
  else if (lowerMessage.includes('mortgage')) calculator_hint = 'mortgage';

  return { url, calculator_hint };
}

/**
 * Scraped page data shape sent from the frontend (legacy DOM-based approach).
 */
interface ScrapedPageData {
  pageTitle: string;
  pageUrl: string;
  pageHeading: string;
  tables: { sectionTitle: string; headers: string[]; rows: string[][] }[];
  summaryCards: { label: string; value: string }[];
}

/**
 * Audits financial data that was scraped directly from the user's browser DOM.
 * Legacy approach — kept for backward compatibility.
 * Prefer auditWithScreenshot() for vision-first analysis.
 */
export async function auditScrapedPageData(
  userMessage: string,
  pageData: ScrapedPageData,
  currentPage: string
): Promise<string> {
  const { getModelForUseCase } = await import('./aiModelService');
  const { generateChatContent: generateChatContentGemini } = await import('./geminiJsonService');
  const { generateChatContent: generateChatContentOllama } = await import('./ollamaService');

  const { provider } = getModelForUseCase('chat');

  // Format only the relevant scraped data (tables with actual rows, summary cards)
  let dataSection = '';

  dataSection += `**Page:** ${pageData.pageTitle} (${currentPage})\n`;
  if (pageData.pageHeading) {
    dataSection += `**Section:** ${pageData.pageHeading}\n`;
  }
  dataSection += '\n';

  // Summary cards
  if (pageData.summaryCards.length > 0) {
    dataSection += `### Summary Cards\n`;
    dataSection += `| Label | Value |\n|-------|-------|\n`;
    pageData.summaryCards.forEach((card) => {
      dataSection += `| ${card.label} | ${card.value} |\n`;
    });
    dataSection += '\n';
  }

  // Tables — only include tables that have actual data rows
  const dataTables = pageData.tables.filter((t) => t.rows.length > 0);
  dataTables.forEach((table, idx) => {
    dataSection += `### Table ${idx + 1}: ${table.sectionTitle || 'Untitled'}\n`;
    if (table.headers.length > 0) {
      dataSection += `| Row | ${table.headers.join(' | ')} |\n`;
      dataSection += `| --- | ${table.headers.map(() => '---').join(' | ')} |\n`;
    }
    table.rows.forEach((row, rowIdx) => {
      dataSection += `| ${rowIdx + 1} | ${row.join(' | ')} |\n`;
    });
    dataSection += `\n*${table.rows.length} rows total*\n\n`;
  });

  const auditPrompt = `You are an **independent financial audit agent** reviewing data scraped from a personal finance application. You behave like a human finance expert — not a developer.

## ROLE & CONSTRAINTS
- You do NOT know the app's internal logic. Do NOT assume correctness.
- Base conclusions ONLY on the observable data and standard finance principles.
- Audit ONLY the financial data section relevant to the user's request.
- IGNORE navigation, headers, marketing text, login prompts, FAQs.
- Never claim 100% correctness. Use "appears", "likely", "suggests".
- Be CONCISE — only report genuine findings. No filler, no padding.

## SCRAPED PAGE DATA
${dataSection}

## AUDIT CHECKLIST
1. **Calculation accuracy**: Verify totals, sums, percentages, P&L are mathematically correct.
2. **Cross-check consistency**: Values across tables and summary cards should agree.
3. **Missing data**: Flag rows missing critical fields (amounts, dates, rates).
4. **Financial logic**: P&L = current value - invested value. Interest rates should be reasonable. Signs should be correct.
5. **Anomalies**: Outliers, negative where positive expected, stale/outdated data.

## SEVERITY CLASSIFICATION
- 🔴 **High**: Incorrect calculation, misleading result, wrong total, directional error
- 🟡 **Medium**: Missing important data, rounding issue, undisclosed assumption
- 🟢 **Low**: UX clarity, missing explanation, trust improvement

## OUTPUT RULES
- Reference specific rows: "Row 2: HDFC FD shows Rs 50,000 but..."
- If user asks about specific rows (e.g., "top 2 rows"), audit ONLY those rows in detail
- End with 2-3 actionable recommendations
- If no issues found, say so in 1-2 sentences — do NOT pad with generic advice
- Total response should be focused and proportional to findings

## USER'S REQUEST
"${userMessage}"`;

  if (provider === 'gemini') {
    return await generateChatContentGemini(auditPrompt);
  } else {
    return await generateChatContentOllama(auditPrompt);
  }
}

/**
 * Vision-first audit: sends a client-captured screenshot to Gemini Vision
 * for financial data analysis. No DOM parsing, no selectors — pure visual analysis.
 *
 * This is the primary audit path for authenticated in-app pages.
 * The frontend captures a screenshot using html2canvas and sends the base64 PNG.
 */
export async function auditWithScreenshot(
  userMessage: string,
  screenshotBase64: string,
  currentPage: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const apiKey = process.env.AI_CHAT_API_KEY || '';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    throw new Error('AI_CHAT_API_KEY is not configured');
  }

  console.log(`[VisualAudit] Analyzing screenshot from ${currentPage} (${(screenshotBase64.length / 1024).toFixed(0)} KB)`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are an independent financial calculation auditor analyzing a screenshot of a personal finance application.

## YOUR ROLE
- You are looking at a SCREENSHOT of a rendered webpage, not source code.
- Treat the visual content as the single source of truth.
- Act like a human finance expert reviewing what's on screen.
- Do NOT assume any formulas or calculations are correct.

## VISUAL INTERPRETATION
- Treat each horizontal card, row, or band as one logical data row.
- Infer column meanings from text labels, alignment, icons, and color semantics.
- Currency symbols (₹, $, €), percentages (%), and date formats identify column types.
- If the image shows cards/tiles instead of a table, treat each card as a data row.
- Green typically means positive/profit, red typically means negative/loss.

## WHAT TO AUDIT
1. **Calculation accuracy**: Verify totals, sums, percentages, P&L are mathematically correct
2. **Cross-check consistency**: Values across different sections should agree
3. **Financial logic**: P&L = current - invested, interest rates reasonable, signs correct
4. **Missing data**: Flag rows with missing critical fields
5. **Anomalies**: Outliers, wrong signs, stale data

## SEVERITY
- 🔴 **High**: Incorrect calculation, wrong total, directional error, misleading result
- 🟡 **Medium**: Missing assumption, rounding issue, undisclosed factor
- 🟢 **Low**: UX clarity, missing explanation, cosmetic concern

## CRITICAL RULES
- If the image shows a login page or no financial data → say so briefly
- NEVER fabricate data not visible in the screenshot
- Use "appears", "likely", "suggests" — never claim 100% certainty
- Be CONCISE — report genuine findings only, no filler
- Reference visual rows by their visible labels (e.g., "HDFC Bank FD row shows...")
- End with 2-3 actionable recommendations

## CURRENT PAGE
${currentPage}

## USER'S REQUEST
"${userMessage}"

Analyze the screenshot and provide a focused audit report.`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: screenshotBase64,
          mimeType: 'image/png',
        },
      },
    ]);

    const response = result.response.text();
    console.log(`[VisualAudit] Analysis complete (${response.length} chars)`);
    return response;
  } catch (err: any) {
    console.error('[VisualAudit] Gemini Vision analysis failed:', err);
    throw new Error(`Visual audit failed: ${err.message || 'Unknown error'}`);
  }
}
