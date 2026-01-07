import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.AI_CHAT_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Generate JSON content using Gemini AI
 */
export async function generateJsonContent(
  prompt: string,
  systemPrompt?: string
): Promise<any> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Combine system prompt and user prompt
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}\n\nCRITICAL: Return ONLY a valid JSON object. No markdown, no explanations, no text before or after the JSON. Start directly with { and end with }.`
      : `${prompt}\n\nCRITICAL: Return ONLY a valid JSON object. No markdown, no explanations, no text outside the JSON. Start directly with { and end with }.`;

    console.log(`[Gemini JSON] Generating JSON content...`);
    console.log(`[Gemini JSON] Model: ${GEMINI_MODEL}`);
    console.log(`[Gemini JSON] Prompt length: ${fullPrompt.length} characters`);

    const requestStartTime = Date.now();
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[Gemini JSON] ✅ Received response (took ${requestDuration}ms)`);
    console.log(`[Gemini JSON] Response length: ${text.length} characters`);

    // Clean up the response
    let jsonText = text.trim();

    // Remove any leading/trailing whitespace or newlines
    jsonText = jsonText.replace(/^\s+|\s+$/g, '');

    // Try multiple extraction strategies
    let extractedJson = null;

    // Strategy 1: Extract from markdown code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      extractedJson = codeBlockMatch[1];
      console.log('[Gemini JSON] ✅ Extracted JSON from markdown code block');
    } else {
      // Strategy 2: Find JSON object boundaries
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        extractedJson = jsonText.substring(jsonStart, jsonEnd + 1);
        console.log('[Gemini JSON] ✅ Extracted JSON object from text boundaries');
      } else {
        // Strategy 3: Try to find any JSON-like structure
        const match = jsonText.match(/\{[\s\S]*\}/);
        if (match) {
          extractedJson = match[0];
          console.log('[Gemini JSON] ✅ Extracted JSON using regex pattern');
        }
      }
    }

    if (!extractedJson) {
      console.error('[Gemini JSON] ❌ Could not extract JSON from response');
      console.error('[Gemini JSON] Full response:', jsonText.substring(0, 500));
      throw new Error('Could not extract JSON from Gemini response. Response may not be valid JSON.');
    }

    // Parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(extractedJson);
      console.log('[Gemini JSON] ✅ Successfully parsed JSON');
    } catch (parseError: any) {
      console.error('[Gemini JSON] ❌ JSON parse error:', parseError.message);
      console.error('[Gemini JSON] Attempted to parse:', extractedJson.substring(0, 500));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }

    // Validate the structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed JSON is not an object');
    }

    return parsed;
  } catch (error: any) {
    console.error('[Gemini JSON] ❌ Error generating JSON content:', error);
    console.error('[Gemini JSON] Error message:', error?.message);
    throw new Error(`Failed to generate JSON content from Gemini: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate text content using Gemini AI
 */
export async function generateTextContent(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt, // Use system instruction for better context
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('[Gemini Text] Error generating content:', error);
    throw new Error(`Failed to generate content from Gemini: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate chat content using Gemini AI (with proper chat history support)
 */
export async function generateChatContent(
  message: string,
  systemPrompt?: string
): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('[Gemini Chat] Error generating content:', error);
    throw new Error(`Failed to generate chat content from Gemini: ${error?.message || 'Unknown error'}`);
  }
}

