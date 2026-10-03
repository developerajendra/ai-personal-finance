/**
 * Pull a single JSON object out of model output that may be wrapped in a
 * markdown fence or surrounded by prose. Throws if nothing parseable is found.
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let candidate = fenced?.[1];
  if (!candidate) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) candidate = trimmed.slice(start, end + 1);
  }
  if (!candidate) throw new Error("Could not extract JSON from model response");
  const parsed: unknown = JSON.parse(candidate);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model response JSON is not an object");
  }
  return parsed as Record<string, unknown>;
}
