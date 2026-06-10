import type { GeminiContentPart } from './geminiService';

/** Max prior turns sent to Gemini (user+model pairs). */
export const HISTORY_MAX_TURNS = 6;
/** Cap per turn — assistant markdown replies are verbose. */
export const HISTORY_MAX_CHARS_PER_TURN = 1200;

export function trimHistoryContent(
  content: string,
  maxChars = HISTORY_MAX_CHARS_PER_TURN
): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/** Shrink chat history before Gemini to cut prompt tokens on multi-turn threads. */
export function compactHistoryForGemini(
  history: GeminiContentPart[] | undefined
): GeminiContentPart[] | undefined {
  if (!history?.length) return undefined;

  const compact = history
    .slice(-HISTORY_MAX_TURNS)
    .map((turn) => ({
      role: turn.role,
      content: trimHistoryContent(turn.content),
    }))
    .filter((turn) => turn.content.length > 0);

  return compact.length > 0 ? compact : undefined;
}
