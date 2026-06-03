import { AppError } from '../utils/apiResponse';

const callTimestamps: number[] = [];

export function resetGeminiUpstreamRateLimit(): void {
  callTimestamps.length = 0;
}

/** Process-wide rolling 60s cap on generateContent calls (free tier ~20 RPM). */
export function checkGeminiUpstreamRateLimit(limitPerMin: number): void {
  const now = Date.now();
  const cutoff = now - 60_000;

  while (callTimestamps.length > 0 && callTimestamps[0]! < cutoff) {
    callTimestamps.shift();
  }

  if (callTimestamps.length >= limitPerMin) {
    throw new AppError(
      429,
      'AI service is at capacity. Please try again in about a minute.'
    );
  }

  callTimestamps.push(now);
}
