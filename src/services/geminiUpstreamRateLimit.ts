import { AppError } from '../utils/apiResponse';

const callTimestamps: number[] = [];
let dailyCalls = 0;
let dailyDayKey = utcDayKey();
let dailyQuotaExhausted = false;

function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function rollDailyCounter(now = Date.now()): void {
  const today = utcDayKey(now);
  if (today !== dailyDayKey) {
    dailyDayKey = today;
    dailyCalls = 0;
    dailyQuotaExhausted = false;
  }
}

export function resetGeminiUpstreamRateLimit(): void {
  callTimestamps.length = 0;
  dailyCalls = 0;
  dailyDayKey = utcDayKey();
  dailyQuotaExhausted = false;
}

export function isGeminiDailyQuotaMessage(message: string): boolean {
  return /free_tier_requests|generate_content_free_tier|per\s*day|perday|requests\s*per\s*day|\bRPD\b|quota.*exceeded|exceeded.*quota|rate limit.*reached/i.test(
    message
  );
}

export function markGeminiDailyQuotaExhausted(): void {
  rollDailyCounter();
  dailyQuotaExhausted = true;
}

export function getGeminiUpstreamRateLimitStats(now = Date.now()) {
  rollDailyCounter(now);
  const cutoff = now - 60_000;
  const rpmWindowCount = callTimestamps.filter((ts) => ts >= cutoff).length;

  return {
    rpmWindowCount,
    dailyCalls,
    dailyDayKey,
    dailyQuotaExhausted,
  };
}

/**
 * Process-wide caps on generateContent calls.
 * Google AI Studio free tier (Gemini 1.5/2.5 Flash) is ~5 RPM and ~20 RPD.
 */
export function checkGeminiUpstreamRateLimit(limitPerMin: number, limitPerDay?: number): void {
  const now = Date.now();
  rollDailyCounter(now);

  if (dailyQuotaExhausted) {
    throw new AppError(
      429,
      'Daily AI quota reached (Google free tier ~20 requests/day). Try again after midnight UTC or enable billing in Google AI Studio.'
    );
  }

  const cutoff = now - 60_000;

  while (callTimestamps.length > 0 && callTimestamps[0]! < cutoff) {
    callTimestamps.shift();
  }

  if (callTimestamps.length >= limitPerMin) {
    throw new AppError(
      429,
      'AI service is at capacity (~5 requests/min on free tier). Please wait about a minute.'
    );
  }

  if (limitPerDay != null && dailyCalls >= limitPerDay) {
    throw new AppError(
      429,
      'Daily AI request limit reached for this server. Try again tomorrow or enable billing in Google AI Studio.'
    );
  }

  callTimestamps.push(now);
  dailyCalls += 1;
}
