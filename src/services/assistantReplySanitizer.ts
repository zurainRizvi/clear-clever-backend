/**
 * Normalizes Gemini assistant output so clients can render chart/stats/compare blocks.
 */
export function sanitizeAssistantReply(text: string): string {
  let sanitized = text.replace(/\r\n/g, '\n');

  sanitized = sanitized.replace(
    /```(chart|stats|compare)\s+with\s+JSON:\s*(\{[\s\S]*?\})\s*(?:```|$)/gi,
    (_match, kind: string, json: string) => `\`\`\`${kind.toLowerCase()}\n${json.trim()}\n\`\`\``,
  );

  sanitized = sanitized.replace(
    /```(chart|stats|compare)[^\n`]*(\{[\s\S]*?\})\s*```/gi,
    (_match, kind: string, json: string) => `\`\`\`${kind.toLowerCase()}\n${json.trim()}\n\`\`\``,
  );

  return sanitized;
}
