import { loadEnv, isGeminiConfigured, type Env } from '../config/env';
import { AppError } from '../utils/apiResponse';
import type { GeminiInlinePart } from './assistantAttachments';
import { checkGeminiUpstreamRateLimit } from './geminiUpstreamRateLimit';
import { recordAssistantUsage, type AssistantUsageRoute } from './assistantUsageTracker';

export interface GeminiContentPart {
  role: 'user' | 'model';
  content: string;
}

export interface GenerateAssistantReplyInput {
  systemInstruction: string;
  userMessage: string;
  history?: GeminiContentPart[];
  attachmentParts?: GeminiInlinePart[];
  usageRoute?: AssistantUsageRoute;
  env?: Env;
}

export interface GenerateAssistantReplyResult {
  text: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

type GeminiPart = { text: string } | GeminiInlinePart;

/** REST body for generativelanguage.googleapis.com (proto JSON uses snake_case). */
type GeminiApiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

function toGeminiApiPart(part: GeminiPart): GeminiApiPart {
  if ('text' in part) {
    return { text: part.text };
  }
  return {
    inline_data: {
      mime_type: part.inlineData.mimeType,
      data: part.inlineData.data,
    },
  };
}

const MAX_503_ATTEMPTS = 2;
const RETRY_503_DELAY_MS = 2000;

let geminiCallQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @internal test helper */
export function resetGeminiCallQueue(): void {
  geminiCallQueue = Promise.resolve();
}

function withGeminiMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = geminiCallQueue.then(fn, fn);
  geminiCallQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Parse "Please retry in 17.00s" from Google quota errors. */
export function parseRetryAfterSeconds(message: string): number | undefined {
  const match = message.match(/retry in\s+([\d.]+)\s*s/i);
  if (!match?.[1]) return undefined;
  const seconds = Math.ceil(parseFloat(match[1]));
  if (!Number.isFinite(seconds) || seconds < 1) return undefined;
  return Math.min(seconds, 120);
}

function mapHttpError(status: number, message: string): AppError {
  if (status === 429) {
    const retrySec = parseRetryAfterSeconds(message);
    const detail =
      retrySec != null
        ? `AI is rate-limited — try again in about ${retrySec} seconds.`
        : 'AI service is busy. Please try again in a moment.';
    return new AppError(429, detail);
  }
  if (status === 401 || status === 403) {
    return new AppError(503, 'AI assistant is misconfigured', ['Check GEMINI_API_KEY on the server']);
  }
  if (status === 404) {
    return new AppError(503, 'AI model is unavailable', ['Verify GEMINI_MODEL is valid for your API key']);
  }
  return new AppError(502, 'AI assistant could not generate a reply', [message]);
}

function shouldRetry503(status: number, attempt: number): boolean {
  return status === 503 && attempt < MAX_503_ATTEMPTS - 1;
}

export function assertGeminiConfigured(env: Env = loadEnv()): void {
  if (!isGeminiConfigured(env)) {
    throw new AppError(
      503,
      'AI assistant is not configured',
      ['GEMINI_API_KEY is required to use the assistant']
    );
  }
}

function buildContents(
  history: GeminiContentPart[] | undefined,
  userMessage: string,
  attachmentParts: GeminiInlinePart[]
): Array<{ role: string; parts: GeminiApiPart[] }> {
  const contents: Array<{ role: string; parts: GeminiApiPart[] }> = [];

  for (const turn of history ?? []) {
    contents.push({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    });
  }

  const userParts: GeminiPart[] = [...attachmentParts, { text: userMessage }];
  contents.push({
    role: 'user',
    parts: userParts.map(toGeminiApiPart),
  });
  return contents;
}

async function generateAssistantReplyInner(
  input: GenerateAssistantReplyInput
): Promise<GenerateAssistantReplyResult> {
  const env = input.env ?? loadEnv();
  assertGeminiConfigured(env);

  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const usageRoute = input.usageRoute ?? 'chat';
  const upstreamRpm = env.GEMINI_UPSTREAM_RPM;

  const body = {
    systemInstruction: {
      parts: [{ text: input.systemInstruction }],
    },
    contents: buildContents(
      input.history,
      input.userMessage,
      input.attachmentParts ?? []
    ),
    generationConfig: {
      maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
      temperature: 0.35,
    },
  };

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt < MAX_503_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_503_DELAY_MS);
    }

    checkGeminiUpstreamRateLimit(upstreamRpm);

    let response: Response;
    const attemptStarted = Date.now();
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': env.GEMINI_API_KEY!,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recordAssistantUsage({
        route: usageRoute,
        ok: false,
        latencyMs: Date.now() - attemptStarted,
        model,
        error: message,
      });
      throw new AppError(502, 'AI assistant could not reach Google', [message]);
    }

    const payload = (await response.json()) as GeminiApiResponse;
    const latencyMs = Date.now() - attemptStarted;

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      lastError = mapHttpError(response.status, message);
      recordAssistantUsage({
        route: usageRoute,
        ok: false,
        latencyMs,
        model,
        statusCode: response.status,
        error: message,
      });
      if (shouldRetry503(response.status, attempt)) {
        continue;
      }
      throw lastError;
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';

    if (!text) {
      recordAssistantUsage({
        route: usageRoute,
        ok: false,
        latencyMs,
        model,
        statusCode: response.status,
        error: 'Empty response from Gemini',
      });
      throw new AppError(502, 'AI assistant returned an empty response');
    }

    recordAssistantUsage({
      route: usageRoute,
      ok: true,
      latencyMs,
      model,
      statusCode: response.status,
      promptTokens: payload.usageMetadata?.promptTokenCount,
      completionTokens: payload.usageMetadata?.candidatesTokenCount,
      totalTokens: payload.usageMetadata?.totalTokenCount,
    });

    return { text };
  }

  throw lastError ?? new AppError(503, 'AI assistant is temporarily unavailable');
}

export async function generateAssistantReply(
  input: GenerateAssistantReplyInput
): Promise<GenerateAssistantReplyResult> {
  return withGeminiMutex(() => generateAssistantReplyInner(input));
}

/** @internal test helper */
export function buildGeminiContentsForTest(input: {
  history?: GeminiContentPart[];
  userMessage: string;
  attachmentParts?: GeminiInlinePart[];
}) {
  return buildContents(input.history, input.userMessage, input.attachmentParts ?? []);
}
