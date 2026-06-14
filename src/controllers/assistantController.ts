import type { Response } from 'express';
import { loadEnv, isGeminiConfigured } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import {
  attachmentsToGeminiParts,
  describeAttachmentsForPrompt,
  parseAttachments,
} from '../services/assistantAttachments';
import {
  buildAssistantContext,
  buildExplainPayload,
  type AssistantContext,
} from '../services/assistantContextService';
import {
  getCachedAssistantContext,
  setCachedAssistantContext,
} from '../services/assistantContextCache';
import { tryAssistantFaqBypass } from '../services/assistantFaqBypass';
import { compactHistoryForGemini } from '../services/assistantHistoryTrim';
import {
  buildExplainSystemInstruction,
  buildSystemInstruction,
} from '../services/assistantPrompts';
import {
  buildExplainCacheKey,
  getExplainCacheEntry,
  setExplainCacheEntry,
} from '../services/explainResponseCache';
import {
  checkAssistantRateLimit,
  rateLimitKeyForRequest,
} from '../services/assistantRateLimit';
import { sanitizeAssistantReply } from '../services/assistantReplySanitizer';
import { generateAssistantReply, type GeminiContentPart } from '../services/geminiService';
import { getGeminiUpstreamRateLimitStats } from '../services/geminiUpstreamRateLimit';
import { AppError, successResponse } from '../utils/apiResponse';
import { parseCategoryForRecommend } from '../services/questionsService';

function clientIp(req: AuthenticatedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function applyRateLimit(req: AuthenticatedRequest, route: string, anonymous: boolean): void {
  const env = loadEnv();
  const limit = anonymous
    ? Math.max(1, Math.floor(env.ASSISTANT_RATE_LIMIT_PER_MIN / 2))
    : env.ASSISTANT_RATE_LIMIT_PER_MIN;

  const key = rateLimitKeyForRequest({
    userId: req.user ? String(req.user._id) : undefined,
    ip: clientIp(req),
    route,
    anonymous,
  });

  checkAssistantRateLimit(key, limit);
}

function parseHistory(raw: unknown): GeminiContentPart[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const history: GeminiContentPart[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      (item as { role?: string }).role &&
      typeof (item as { content?: string }).content === 'string'
    ) {
      const role = (item as { role: string }).role;
      if (role !== 'user' && role !== 'model') {
        continue;
      }
      const content = (item as { content: string }).content.trim();
      if (content.length > 0) {
        history.push({ role, content });
      }
    }
  }

  return compactHistoryForGemini(history);
}

function hasPriorAssistantReply(history: GeminiContentPart[] | undefined): boolean {
  return Boolean(history?.some((turn) => turn.role === 'model'));
}

export async function getAssistantStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const upstream = getGeminiUpstreamRateLimitStats();
  res.status(200).json(
    successResponse('Assistant status', {
      configured: isGeminiConfigured(env),
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      quota: {
        dailyLimit: env.GEMINI_UPSTREAM_RPD,
        dailyUsed: upstream.dailyCalls,
        dailyExhausted: upstream.dailyQuotaExhausted,
        rpmLimit: env.GEMINI_UPSTREAM_RPM,
        rpmUsed: upstream.rpmWindowCount,
      },
      attachments: {
        maxFiles: 3,
        maxBytesPerFile: 4 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
      },
    })
  );
}

export async function postAssistantChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const body = req.body as {
    message?: string;
    history?: unknown;
    category?: string;
    attachments?: unknown;
    sessionKey?: string;
  };

  const attachments = parseAttachments(body.attachments);
  const messageRaw = typeof body.message === 'string' ? body.message.trim() : '';
  const message =
    messageRaw ||
    (attachments.length > 0
      ? 'Please review the attached file(s) and answer based on what you see.'
      : '');

  if (message.length < 1) {
    throw new AppError(400, 'Validation failed', ['message: required unless attachments are provided']);
  }
  if (message.length > 2000) {
    throw new AppError(400, 'Validation failed', ['message: must be 1–2000 characters']);
  }

  const anonymous = !req.user;
  applyRateLimit(req, 'chat', anonymous);

  const history = parseHistory(body.history);
  const followUp = hasPriorAssistantReply(history);

  const sessionKey =
    typeof body.sessionKey === 'string' && body.sessionKey.trim().length > 0
      ? body.sessionKey.trim()
      : undefined;

  let context: AssistantContext;
  if (followUp && req.user) {
    const cached = getCachedAssistantContext(String(req.user._id), sessionKey);
    context = cached
      ? { ...cached }
      : await buildAssistantContext(req.user);
  } else {
    context = await buildAssistantContext(req.user);
  }

  if (req.user) {
    setCachedAssistantContext(String(req.user._id), context, sessionKey);
  }
  if (attachments.length > 0) {
    context.currentMessageAttachments = attachments.map((a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
    }));
  }
  if (body.category && context.personalized && req.user?.role === 'user') {
    const category = parseCategoryForRecommend(body.category);
    if (category && context.topRecommendations) {
      const focused = context.topRecommendations.find((r) => r.category === category);
      if (focused) {
        context.topRecommendations = [
          focused,
          ...context.topRecommendations.filter((r) => r.category !== category),
        ];
      }
    }
  }

  const faqReply = tryAssistantFaqBypass({
    message,
    audience: context.audience,
    hasAttachments: attachments.length > 0,
    hasPriorAssistantReply: followUp,
    addressing: context.addressing,
  });

  if (faqReply) {
    res.status(200).json(
      successResponse('Assistant reply', {
        reply: faqReply,
        personalized: context.personalized,
        audience: context.audience,
      })
    );
    return;
  }

  const systemInstruction = buildSystemInstruction(context, { followUp });

  let userMessage = message + describeAttachmentsForPrompt(attachments);

  if (anonymous) {
    userMessage += '\n\n(Note: user is not signed in — keep answers general and suggest signing in for personalized recommendations.)';
  } else if (context.addressing && !hasPriorAssistantReply(history)) {
    userMessage += `\n\n(Note: this is the start of the conversation — greet the user by full name "${context.addressing.fullName}" in your reply.)`;
  }

  const { text } = await generateAssistantReply({
    systemInstruction,
    userMessage,
    history,
    attachmentParts: attachmentsToGeminiParts(attachments),
    usageRoute: 'chat',
    env,
  });

  res.status(200).json(
    successResponse('Assistant reply', {
      reply: sanitizeAssistantReply(text),
      personalized: context.personalized,
      audience: context.audience,
    })
  );
}

export async function postAssistantExplain(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const body = req.body as { category?: string; policyId?: string };

  if (!req.user || req.user.role !== 'user') {
    throw new AppError(403, 'Policy explanations are available to policy seekers only');
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!parseCategoryForRecommend(category)) {
    throw new AppError(400, 'Validation failed', ['category: must be a valid policy category']);
  }

  applyRateLimit(req, 'explain', false);

  const explainPayload = await buildExplainPayload({
    user: req.user,
    category,
    policyId: typeof body.policyId === 'string' ? body.policyId : undefined,
  });

  const cacheKey = buildExplainCacheKey({
    userId: String(req.user._id),
    category,
    policyId: explainPayload.target.policyId,
    answers: explainPayload.answers,
    score: explainPayload.target.score,
  });

  const cachedExplain = getExplainCacheEntry(cacheKey);
  if (cachedExplain) {
    res.status(200).json(
      successResponse('Recommendation explained', {
        reply: cachedExplain.reply,
        policyId: cachedExplain.policyId,
        policyName: cachedExplain.policyName,
        score: cachedExplain.score,
      })
    );
    return;
  }

  const systemInstruction = buildExplainSystemInstruction({
    addressing: explainPayload.context.addressing,
    target: explainPayload.target,
    answers: explainPayload.answers,
    topThree: explainPayload.topThree,
  });

  const greetNote = explainPayload.context.addressing
    ? ` Address the user as ${explainPayload.context.addressing.fullName} in the opening sentence.`
    : '';

  const userMessage = `Explain why "${explainPayload.target.name}" (rank #${explainPayload.target.rank}) is a good match for me.${greetNote}`;

  const { text } = await generateAssistantReply({
    systemInstruction,
    userMessage,
    usageRoute: 'explain',
    env,
  });

  const reply = sanitizeAssistantReply(text);

  setExplainCacheEntry(cacheKey, {
    reply,
    policyId: explainPayload.target.policyId,
    policyName: explainPayload.target.name,
    score: explainPayload.target.score,
  });

  res.status(200).json(
    successResponse('Recommendation explained', {
      reply,
      policyId: explainPayload.target.policyId,
      policyName: explainPayload.target.name,
      score: explainPayload.target.score,
    })
  );
}
