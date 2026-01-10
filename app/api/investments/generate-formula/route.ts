import { NextRequest, NextResponse } from "next/server";
import { generateChatContent } from "@/core/services/geminiJsonService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleLabel } = body;

    if (!ruleLabel) {
      return NextResponse.json(
        { error: "Rule label is required" },
        { status: 400 }
      );
    }

    // Simple rule parsing for common patterns
    const parseRule = (label: string): string | null => {
      const lowerLabel = label.toLowerCase().trim();
      
      // Pattern: "5x in 12 Years" or "5x in 12 years"
      const multiplierMatch = lowerLabel.match(/(\d+(?:\.\d+)?)x\s+in\s+(\d+(?:\.\d+)?)\s+years?/i);
      if (multiplierMatch) {
        const multiplier = multiplierMatch[1];
        const years = multiplierMatch[2];
        return `principal * Math.pow(${multiplier}, (yearsElapsed / ${years}))`;
      }

      // Pattern: "Double in 5 Years" or "double in 5 years"
      if (lowerLabel.includes('double')) {
        const yearsMatch = lowerLabel.match(/double\s+in\s+(\d+(?:\.\d+)?)\s+years?/i);
        if (yearsMatch) {
          const years = yearsMatch[1];
          return `principal * Math.pow(2, (yearsElapsed / ${years}))`;
        }
      }

      // Pattern: "Triple in 7 Years"
      if (lowerLabel.includes('triple')) {
        const yearsMatch = lowerLabel.match(/triple\s+in\s+(\d+(?:\.\d+)?)\s+years?/i);
        if (yearsMatch) {
          const years = yearsMatch[1];
          return `principal * Math.pow(3, (yearsElapsed / ${years}))`;
        }
      }

      return null;
    };

    // Try simple parsing first
    let formula = parseRule(ruleLabel);

    // If simple parsing fails, use AI
    if (!formula) {
      const systemPrompt = `You are a financial formula generator. Convert investment rules into JavaScript formulas.

Rules format:
- "5x in 12 Years" → principal * Math.pow(5, (yearsElapsed / 12))
- "10x in 20 Years" → principal * Math.pow(10, (yearsElapsed / 20))
- "Double in 5 Years" → principal * Math.pow(2, (yearsElapsed / 5))
- "Triple in 7 Years" → principal * Math.pow(3, (yearsElapsed / 7))

Return ONLY the JavaScript formula expression. Use variables: principal, amount, yearsElapsed, daysElapsed, monthsElapsed, Math functions.`;

      const prompt = `Convert this rule to a JavaScript formula: "${ruleLabel}"

Return only the formula expression, no explanations.`;

      try {
        const aiResponse = await generateChatContent(prompt, systemPrompt);
        
        // Clean up the response
        let cleanFormula = aiResponse.trim();
        cleanFormula = cleanFormula.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
        
        // Remove quotes if present
        cleanFormula = cleanFormula.replace(/^["']|["']$/g, '');
        
        // Extract formula pattern
        const formulaMatch = cleanFormula.match(/(principal|amount)\s*[\*\w\(\)\.\/\s,\-]+/);
        if (formulaMatch) {
          formula = formulaMatch[0].trim();
        } else if (cleanFormula.includes('Math.pow') || cleanFormula.includes('principal') || cleanFormula.includes('amount')) {
          // If it contains key formula elements, use it as is
          formula = cleanFormula;
        }
      } catch (aiError: any) {
        console.error("AI generation error:", aiError);
        // Fall back to simple parsing or default formula
        throw new Error(`Failed to generate formula: ${aiError.message}`);
      }
    }

    if (!formula) {
      return NextResponse.json(
        { error: "Could not parse rule. Please use format like '5x in 12 Years' or 'Double in 5 Years'" },
        { status: 400 }
      );
    }

    // Validate the formula is safe - check for dangerous patterns instead of strict character matching
    const dangerousPatterns = [
      /eval\s*\(/i,
      /function\s*\(/i,
      /require\s*\(/i,
      /import\s+/i,
      /process\./i,
      /global\./i,
      /window\./i,
      /document\./i,
      /localStorage/i,
      /sessionStorage/i,
      /fetch\s*\(/i,
      /XMLHttpRequest/i,
      /\.exec\s*\(/i,
      /\.call\s*\(/i,
      /\.apply\s*\(/i,
    ];

    const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(formula));
    if (hasDangerousPattern) {
      return NextResponse.json(
        { error: "Generated formula contains unsafe code patterns" },
        { status: 400 }
      );
    }

    // Ensure formula contains at least one allowed variable
    const allowedVariables = /(principal|amount|yearsElapsed|daysElapsed|monthsElapsed|Math\.)/;
    if (!allowedVariables.test(formula)) {
      return NextResponse.json(
        { error: "Formula must use allowed variables: principal, amount, yearsElapsed, daysElapsed, monthsElapsed, or Math functions" },
        { status: 400 }
      );
    }

    return NextResponse.json({ formula });
  } catch (error: any) {
    console.error("Error generating formula:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate formula. Please check your AI service configuration." },
      { status: 500 }
    );
  }
}
