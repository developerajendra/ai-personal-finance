import { Ollama } from "ollama";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3:latest";

const ollama = new Ollama({ host: OLLAMA_HOST });

export interface OllamaResponse {
  response: string;
}

/**
 * Test connection to Ollama server
 * This will verify that Ollama is accessible and the model is available
 */
export async function testOllamaConnection(): Promise<{ connected: boolean; error?: string; modelAvailable?: boolean }> {
  try {
    console.log(`[Ollama Connection Test] Testing connection to ${OLLAMA_HOST}...`);
    
    // Test 1: Check if server is reachable by listing models
    const models = await ollama.list();
    console.log(`[Ollama Connection Test] ✅ Server is reachable! Found ${models.models.length} model(s)`);
    console.log(`[Ollama Connection Test] Available models:`, models.models.map(m => m.name).join(", "));
    
    // Test 2: Check if our model is available
    const modelExists = models.models.some(m => m.name === MODEL_NAME || m.name.startsWith(MODEL_NAME.split(":")[0]));
    if (!modelExists) {
      console.warn(`[Ollama Connection Test] ⚠️ Model "${MODEL_NAME}" not found. Available models: ${models.models.map(m => m.name).join(", ")}`);
      return { connected: true, modelAvailable: false, error: `Model "${MODEL_NAME}" not found` };
    }
    
    console.log(`[Ollama Connection Test] ✅ Model "${MODEL_NAME}" is available`);
    
    // Test 3: Try a simple generation to verify the model works
    console.log(`[Ollama Connection Test] Testing model with a simple prompt...`);
    const testResponse = await ollama.generate({
      model: MODEL_NAME,
      prompt: "Say 'OK' if you can read this.",
      stream: false,
      options: {
        num_ctx: 512,
      },
    });
    
    console.log(`[Ollama Connection Test] ✅ Model responded: "${testResponse.response.substring(0, 50)}..."`);
    console.log(`[Ollama Connection Test] ✅ Connection test PASSED!`);
    
    return { connected: true, modelAvailable: true };
  } catch (error: any) {
    console.error(`[Ollama Connection Test] ❌ Connection test FAILED:`, error);
    console.error(`[Ollama Connection Test] Error message:`, error?.message);
    console.error(`[Ollama Connection Test] Error stack:`, error?.stack);
    return { 
      connected: false, 
      error: error?.message || "Unknown error",
      modelAvailable: false 
    };
  }
}

export async function generateContent(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const finalPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: finalPrompt,
      stream: false,
      options: {
        num_ctx: 8192,
      },
    });

    return response.response;
  } catch (error) {
    console.error("Error generating content with Ollama:", error);
    throw new Error("Failed to generate content from Ollama");
  }
}

export async function generateChatContent(
  message: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: message });

    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: messages,
      stream: false,
      options: {
        num_ctx: 8192,
      },
    });

    return response.message.content;
  } catch (error) {
    console.error("Error generating chat content with Ollama:", error);
    throw new Error("Failed to generate chat content from Ollama");
  }
}

export async function generateJsonContent(prompt: string, systemPrompt?: string): Promise<any> {
  try {
    // Use chat API instead of generate for better JSON support
    const systemMessage = systemPrompt || "You are a financial data analyst AI. You must respond with ONLY valid JSON. No markdown, no explanations, no text before or after the JSON.";
    const userMessage = `${prompt}\n\nCRITICAL: Return ONLY a valid JSON object. Do not include any markdown code blocks, explanations, or text outside the JSON. Start directly with { and end with }.`;

    console.log(`[Ollama] ========================================`);
    console.log(`[Ollama] 🚀 Starting JSON generation request`);
    console.log(`[Ollama] Host: ${OLLAMA_HOST}`);
    console.log(`[Ollama] Model: ${MODEL_NAME}`);
    console.log(`[Ollama] Using chat API for better JSON support`);
    console.log(`[Ollama] System prompt length: ${systemMessage.length} characters`);
    console.log(`[Ollama] User prompt length: ${userMessage.length} characters`);
    console.log(`[Ollama] Request URL: ${OLLAMA_HOST}/api/chat`);
    console.log(`[Ollama] ========================================`);

    const requestStartTime = Date.now();
    console.log(`[Ollama] ⏱️  Sending request to Ollama at ${new Date().toISOString()}...`);

    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      stream: false,
      options: {
        num_ctx: 8192,
        temperature: 0.1, // Lower temperature for more consistent JSON output
      },
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[Ollama] ✅ Received response from Ollama (took ${requestDuration}ms)`);

    let jsonText = response.message.content;
    console.log(`[Ollama] Raw response length: ${jsonText.length} characters`);
    console.log(`[Ollama] Raw response preview: ${jsonText.substring(0, 500)}...`);

    // Clean up the response
    jsonText = jsonText.trim();

    // Remove any leading/trailing whitespace or newlines
    jsonText = jsonText.replace(/^\s+|\s+$/g, '');

    // Try multiple extraction strategies
    let extractedJson = null;

    // Strategy 1: Extract from markdown code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      extractedJson = codeBlockMatch[1];
      console.log("[Ollama] ✅ Extracted JSON from markdown code block");
    } else {
      // Strategy 2: Find JSON object boundaries
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        extractedJson = jsonText.substring(jsonStart, jsonEnd + 1);
        console.log("[Ollama] ✅ Extracted JSON object from text boundaries");
      } else {
        // Strategy 3: Try to find any JSON-like structure
        const match = jsonText.match(/\{[\s\S]*\}/);
        if (match) {
          extractedJson = match[0];
          console.log("[Ollama] ✅ Extracted JSON using regex pattern");
        }
      }
    }

    if (!extractedJson) {
      console.error("[Ollama] ❌ Could not extract JSON from response");
      console.error("[Ollama] Full response:", jsonText);
      throw new Error("Could not extract JSON from Ollama response. Response may not be valid JSON.");
    }

    // Parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(extractedJson);
      console.log("[Ollama] ✅ Successfully parsed JSON");
      console.log("[Ollama] JSON structure:", {
        hasInvestments: !!parsed.investments,
        investmentsCount: parsed.investments?.length || 0,
        hasLoans: !!parsed.loans,
        loansCount: parsed.loans?.length || 0,
        hasProperties: !!parsed.properties,
        propertiesCount: parsed.properties?.length || 0,
        hasBankBalances: !!parsed.bankBalances,
        bankBalancesCount: parsed.bankBalances?.length || 0,
      });
    } catch (parseError: any) {
      console.error("[Ollama] ❌ JSON parse error:", parseError.message);
      console.error("[Ollama] Attempted to parse:", extractedJson.substring(0, 500));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }

    // Validate the structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error("Parsed JSON is not an object");
    }

    // Ensure all required arrays exist
    if (!Array.isArray(parsed.investments)) parsed.investments = [];
    if (!Array.isArray(parsed.loans)) parsed.loans = [];
    if (!Array.isArray(parsed.properties)) parsed.properties = [];
    if (!Array.isArray(parsed.bankBalances)) parsed.bankBalances = [];

    console.log(`[Ollama] ✅ Final validated structure: ${parsed.investments.length} investments, ${parsed.loans.length} loans, ${parsed.properties.length} properties, ${parsed.bankBalances.length} bank balances`);
    
    return parsed;
  } catch (error: any) {
    console.error("[Ollama] ❌ Error generating JSON content:", error);
    console.error("[Ollama] Error message:", error?.message);
    console.error("[Ollama] Error stack:", error?.stack);
    throw new Error(`Failed to generate JSON content from Ollama: ${error?.message || "Unknown error"}`);
  }
}
