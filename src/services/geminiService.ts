import { loadEnv, isGeminiConfigured, type Env } from '../config/env';
import { AppError } from '../utils/apiResponse';
import type { GeminiInlinePart } from './assistantAttachments';
import {
  checkGeminiUpstreamRateLimit,
  isGeminiDailyQuotaMessage,
  markGeminiDailyQuotaExhausted,
} from './geminiUpstreamRateLimit';
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

export interface GenerateStructuredJsonInput {
  systemInstruction: string;
  userMessage: string;
  attachmentParts?: GeminiInlinePart[];
  responseSchema: Record<string, unknown>;
  usageRoute?: AssistantUsageRoute;
  env?: Env;
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

const MAX_503_ATTEMPTS = 3;
const RETRY_503_DELAY_MS = 2000;

/** Try to salvage JSON from model output (markdown fences, trailing prose). */
export function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseStructuredJsonText<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const extracted = extractJsonPayload(text);
    if (extracted !== text.trim()) {
      return JSON.parse(extracted) as T;
    }
    throw new Error('Could not parse structured response');
  }
}

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
    if (isGeminiDailyQuotaMessage(message)) {
      markGeminiDailyQuotaExhausted();
      return new AppError(
        429,
        'Daily AI quota reached (Google free tier ~20 requests/day). Try again after midnight UTC or enable billing in Google AI Studio.'
      );
    }
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
  if (/high demand/i.test(message)) {
    return new AppError(
      503,
      'AI is experiencing high demand — please wait a moment and try again.',
      [message]
    );
  }
  return new AppError(502, 'AI assistant could not generate a reply', [message]);
}

function isTransientGeminiError(status: number, message: string): boolean {
  if (status === 503) return true;
  if (status === 429 || isGeminiDailyQuotaMessage(message)) return false;
  return /high demand|temporarily unavailable|overloaded/i.test(message);
}

function shouldRetryGemini(status: number, message: string, attempt: number): boolean {
  return attempt < MAX_503_ATTEMPTS - 1 && isTransientGeminiError(status, message);
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

async function callGeminiApi(
  env: Env,
  model: string,
  body: Record<string, unknown>,
  usageRoute: AssistantUsageRoute
): Promise<{ text: string; usageMetadata?: GeminiApiResponse['usageMetadata'] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const upstreamRpm = env.GEMINI_UPSTREAM_RPM;
  const upstreamRpd = env.GEMINI_UPSTREAM_RPD;
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt < MAX_503_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_503_DELAY_MS);
    }

    checkGeminiUpstreamRateLimit(upstreamRpm, upstreamRpd);

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
      if (shouldRetryGemini(response.status, message, attempt)) {
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

    return { text, usageMetadata: payload.usageMetadata };
  }

  throw lastError ?? new AppError(503, 'AI assistant is temporarily unavailable');
}

async function generateAssistantReplyInner(
  input: GenerateAssistantReplyInput
): Promise<GenerateAssistantReplyResult> {
  const env = input.env ?? loadEnv();
  assertGeminiConfigured(env);

  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const usageRoute = input.usageRoute ?? 'chat';

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

  const { text } = await callGeminiApi(env, model, body, usageRoute);
  return { text };
}

export async function generateAssistantReply(
  input: GenerateAssistantReplyInput
): Promise<GenerateAssistantReplyResult> {
  return withGeminiMutex(() => generateAssistantReplyInner(input));
}

async function generateStructuredJsonInner<T>(
  input: GenerateStructuredJsonInput
): Promise<T> {
  const env = input.env ?? loadEnv();
  assertGeminiConfigured(env);

  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const usageRoute = input.usageRoute ?? 'claim_intelligence';

  const body = {
    systemInstruction: {
      parts: [{ text: input.systemInstruction }],
    },
    contents: buildContents(undefined, input.userMessage, input.attachmentParts ?? []),
    generationConfig: {
      maxOutputTokens: Math.max(env.GEMINI_MAX_OUTPUT_TOKENS, 4096),
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: input.responseSchema,
    },
  };

  const { text } = await callGeminiApi(env, model, body, usageRoute);

  try {
    return parseStructuredJsonText<T>(text);
  } catch {
    throw new AppError(
      502,
      'AI analysis could not be completed — please try again in a moment.',
      ['The response was incomplete. Wait a few seconds and retry.']
    );
  }
}

export async function generateStructuredJson<T>(
  input: GenerateStructuredJsonInput
): Promise<T> {
  return withGeminiMutex(() => generateStructuredJsonInner<T>(input));
}

/** @internal test helper */
export function buildGeminiContentsForTest(input: {
  history?: GeminiContentPart[];
  userMessage: string;
  attachmentParts?: GeminiInlinePart[];
}) {
  return buildContents(input.history, input.userMessage, input.attachmentParts ?? []);
}
