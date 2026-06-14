import { isGeminiConfigured, loadEnv, type Env } from '../config/env';
import type { ServiceProbe } from './infrastructureHealth';
import { getAssistantRateLimitStats } from './assistantRateLimit';
import { getAssistantUsageSummary } from './assistantUsageTracker';
import { getGeminiUpstreamRateLimitStats } from './geminiUpstreamRateLimit';

const PROBE_TIMEOUT_MS = 8000;

interface GeminiModelResource {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface GeminiModelResponse {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  error?: { message?: string; code?: number };
}

export interface AssistantHealthReport {
  configured: boolean;
  apiKeySet: boolean;
  ok: boolean;
  latencyMs: number;
  label: string;
  detail?: string;
  model: string;
  modelResourceName?: string;
  displayName?: string;
  modelAvailable: boolean;
  supportedGenerationMethods: string[];
  speechToText: {
    provider: string;
    surfaces: string[];
    languages: string[];
    note: string;
  };
  vision: {
    supportedMimeTypes: string[];
    maxAttachmentsPerMessage: number;
    maxBytesPerAttachment: number;
    useCases: Array<{ route: string; label: string; description: string }>;
    apiCallsSinceDeploy: {
      chat: number;
      kyc: number;
      claimIntelligence: number;
    };
  };
  limits: {
    configuredMaxOutputTokens: number;
    configuredChatMaxOutputTokens: number;
    modelInputTokenLimit?: number;
    modelOutputTokenLimit?: number;
    assistantRateLimitPerMin: number;
    anonymousRateLimitPerMin: number;
    geminiUpstreamRpm: number;
    geminiUpstreamRpd: number;
    maxAttachmentsPerMessage: number;
    maxBytesPerAttachment: number;
    allowedAttachmentMimeTypes: string[];
  };
  usage: ReturnType<typeof getAssistantUsageSummary>;
  internalRateLimits: ReturnType<typeof getAssistantRateLimitStats>;
  upstreamRateLimits: ReturnType<typeof getGeminiUpstreamRateLimitStats>;
  diagnostics: string[];
  notes: string[];
}

function normalizeModelId(model: string): string {
  return model.replace(/^models\//, '');
}

async function fetchConfiguredModel(env: Env): Promise<{
  ok: boolean;
  latencyMs: number;
  model?: GeminiModelResource;
  error?: string;
  statusCode?: number;
}> {
  const modelId = normalizeModelId(env.GEMINI_MODEL ?? 'gemini-2.5-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}`;
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-goog-api-key': env.GEMINI_API_KEY!,
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    const payload = (await response.json()) as GeminiModelResponse;

    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        statusCode: response.status,
        error: payload.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return { ok: true, latencyMs, model: payload };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Gemini probe failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAssistantHealthReport(env: Env = loadEnv()): Promise<AssistantHealthReport> {
  const configured = isGeminiConfigured(env);
  const model = normalizeModelId(env.GEMINI_MODEL ?? 'gemini-2.5-flash');
  const usage = getAssistantUsageSummary();
  const internalRateLimits = getAssistantRateLimitStats();
  const upstreamRateLimits = getGeminiUpstreamRateLimitStats();
  const diagnostics: string[] = [];
  const notes: string[] = [
    'Google AI Studio free tier is ~5 requests/min and ~20 requests/day per model (see Rate limits in AI Studio). Totals below are tracked by this API process since last deploy.',
    'If daily quota is exhausted, enable billing in Google AI Studio or wait until the daily reset.',
  ];

  if (upstreamRateLimits.dailyQuotaExhausted) {
    diagnostics.push(
      `Daily AI quota exhausted (${upstreamRateLimits.dailyCalls} generateContent call(s) today). Resets at midnight UTC or enable billing in Google AI Studio.`
    );
  } else if (upstreamRateLimits.dailyCalls >= env.GEMINI_UPSTREAM_RPD - 2) {
    diagnostics.push(
      `Approaching daily AI cap: ${upstreamRateLimits.dailyCalls}/${env.GEMINI_UPSTREAM_RPD} guarded requests today (Google free tier ~20/day).`
    );
  }

  if (usage.rateLimitErrors > 0) {
    diagnostics.push(
      `${usage.rateLimitErrors} Gemini 429 response(s) since deploy — free tier is ~5 RPM and ~20 RPD. Wait ~60s between tests; do not rapid-retry.`
    );
  }

  const recentQuotaErrors = usage.recentErrors.some((e) =>
    /free_tier_requests|generate_content_free_tier/i.test(e.message)
  );
  if (
    recentQuotaErrors &&
    usage.failedApiCalls > usage.successfulApiCalls &&
    usage.totalApiCalls >= 2
  ) {
    diagnostics.push(
      'Google free-tier request quota was hit. Each user message should cause only one upstream generateContent call (older deploys retried 429 up to 4×). Redeploy if failures persist after cooldown.'
    );
  }

  if (usage.failedApiCalls > usage.successfulApiCalls && usage.totalApiCalls >= 3) {
    diagnostics.push('Failure rate is high — review recent errors below and verify quota on Google AI Studio.');
  }

  if (internalRateLimits.activeBuckets > 0) {
    diagnostics.push(
      `${internalRateLimits.activeBuckets} active internal rate-limit bucket(s); ${internalRateLimits.totalTrackedRequests} assistant route hit(s) in the current rolling minute windows.`
    );
  }

  const limits = {
    configuredMaxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
    configuredChatMaxOutputTokens: env.GEMINI_CHAT_MAX_OUTPUT_TOKENS,
    assistantRateLimitPerMin: env.ASSISTANT_RATE_LIMIT_PER_MIN,
    anonymousRateLimitPerMin: Math.max(1, Math.floor(env.ASSISTANT_RATE_LIMIT_PER_MIN / 2)),
    geminiUpstreamRpm: env.GEMINI_UPSTREAM_RPM,
    geminiUpstreamRpd: env.GEMINI_UPSTREAM_RPD,
    maxAttachmentsPerMessage: 3,
    maxBytesPerAttachment: 4 * 1024 * 1024,
    allowedAttachmentMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ],
    modelInputTokenLimit: undefined as number | undefined,
    modelOutputTokenLimit: undefined as number | undefined,
  };

  const speechToText = {
    provider: 'Web Speech API (browser)',
    surfaces: ['AI Assistant', 'Messages chat'],
    languages: ['English (Pakistan)', 'Urdu', 'English (US)'],
    note: 'Runs entirely in the user browser — no Gemini quota or server latency.',
  };

  const vision = {
    supportedMimeTypes: limits.allowedAttachmentMimeTypes,
    maxAttachmentsPerMessage: limits.maxAttachmentsPerMessage,
    maxBytesPerAttachment: limits.maxBytesPerAttachment,
    useCases: [
      {
        route: 'chat',
        label: 'Assistant image & PDF attachments',
        description:
          'Multimodal chat — policy photos, CNIC scans, and PDFs sent inline with user messages.',
      },
      {
        route: 'kyc',
        label: 'CNIC photo verification',
        description: 'Structured JSON extraction from CNIC front images for identity scoring.',
      },
      {
        route: 'claim_intelligence',
        label: 'Claim evidence analysis',
        description: 'Vision-assisted damage photos and documents for insurer claim intelligence.',
      },
    ],
    apiCallsSinceDeploy: {
      chat: usage.chatApiCalls,
      kyc: usage.kycApiCalls,
      claimIntelligence: usage.claimIntelligenceApiCalls,
    },
  };

  if (!configured) {
    diagnostics.push('GEMINI_API_KEY is not set — the assistant widget stays hidden.');
    return {
      configured: false,
      apiKeySet: false,
      ok: false,
      latencyMs: 0,
      label: 'Gemini AI assistant',
      detail: 'Not configured',
      model,
      modelAvailable: false,
      supportedGenerationMethods: [],
      speechToText,
      vision,
      limits,
      usage,
      internalRateLimits,
      upstreamRateLimits,
      diagnostics,
      notes,
    };
  }

  const probe = await fetchConfiguredModel(env);

  if (!probe.ok) {
    if (probe.statusCode === 429) {
      diagnostics.push('Gemini returned HTTP 429 on model probe — upstream quota is likely exhausted.');
    } else if (probe.statusCode === 404) {
      diagnostics.push(`Model "${model}" was not found for this API key. Set GEMINI_MODEL to a supported model.`);
    } else if (probe.error) {
      diagnostics.push(`Gemini probe error: ${probe.error}`);
    }
  } else {
    diagnostics.push(`Model "${probe.model?.displayName ?? model}" is reachable via Google Generative Language API.`);
    if (probe.model?.supportedGenerationMethods?.includes('generateContent') === false) {
      diagnostics.push('Configured model does not list generateContent support.');
    }
  }

  limits.modelInputTokenLimit = probe.model?.inputTokenLimit;
  limits.modelOutputTokenLimit = probe.model?.outputTokenLimit;

  return {
    configured: true,
    apiKeySet: true,
    ok: probe.ok,
    latencyMs: probe.latencyMs,
    label: 'Gemini AI assistant',
    detail: probe.ok
      ? `${probe.model?.displayName ?? model} reachable`
      : probe.error ?? 'Probe failed',
    model,
    modelResourceName: probe.model?.name,
    displayName: probe.model?.displayName,
    modelAvailable: probe.ok,
    supportedGenerationMethods: probe.model?.supportedGenerationMethods ?? [],
    speechToText,
    vision,
    limits,
    usage,
    internalRateLimits,
    upstreamRateLimits,
    diagnostics,
    notes,
  };
}

export async function getAssistantInfrastructureProbe(env: Env = loadEnv()): Promise<ServiceProbe> {
  const report = await getAssistantHealthReport(env);
  return {
    ok: report.ok,
    latencyMs: report.latencyMs,
    label: report.label,
    detail: report.detail,
  };
}
