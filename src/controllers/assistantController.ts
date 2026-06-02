import type { Response } from 'express';
import { loadEnv, isGeminiConfigured } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import {
  buildAssistantContext,
  buildExplainPayload,
  buildExplainSystemInstruction,
  buildSystemInstruction,
} from '../services/assistantContextService';
import {
  checkAssistantRateLimit,
  rateLimitKeyForRequest,
} from '../services/assistantRateLimit';
import { generateAssistantReply, type GeminiContentPart } from '../services/geminiService';
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

function parseHistory(
  raw: unknown
): GeminiContentPart[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const history: GeminiContentPart[] = [];
  for (const item of raw.slice(-10)) {
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
      if (content.length > 0 && content.length <= 4000) {
        history.push({ role, content });
      }
    }
  }

  return history.length > 0 ? history : undefined;
}

export async function getAssistantStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  res.status(200).json(
    successResponse('Assistant status', {
      configured: isGeminiConfigured(env),
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    })
  );
}

export async function postAssistantChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const body = req.body as {
    message?: string;
    history?: unknown;
    category?: string;
  };

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < 1 || message.length > 2000) {
    throw new AppError(400, 'Validation failed', ['message: must be 1–2000 characters']);
  }

  const anonymous = !req.user;
  applyRateLimit(req, 'chat', anonymous);

  const context = await buildAssistantContext(req.user);
  if (body.category && context.personalized && req.user?.role === 'user') {
    const category = parseCategoryForRecommend(body.category);
    if (category && context.topRecommendations) {
      const focused = context.topRecommendations.find((r) => r.category === category);
      if (focused) {
        context.topRecommendations = [focused, ...context.topRecommendations.filter((r) => r.category !== category)];
      }
    }
  }

  const systemInstruction = buildSystemInstruction(context);
  const history = parseHistory(body.history);

  const userMessage = anonymous
    ? `${message}\n\n(Note: user is not signed in — keep answers general and suggest signing in for personalized recommendations.)`
    : message;

  const { text } = await generateAssistantReply({
    systemInstruction,
    userMessage,
    history,
    env,
  });

  res.status(200).json(
    successResponse('Assistant reply', {
      reply: text,
      personalized: context.personalized,
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

  const systemInstruction = buildExplainSystemInstruction(explainPayload.context, {
    target: explainPayload.target,
    answers: explainPayload.answers,
    topThree: explainPayload.topThree,
  });

  const userMessage = `Explain why "${explainPayload.target.name}" (rank #${explainPayload.target.rank}) is a good match for me.`;

  const { text } = await generateAssistantReply({
    systemInstruction,
    userMessage,
    env,
  });

  res.status(200).json(
    successResponse('Recommendation explained', {
      reply: text,
      policyId: explainPayload.target.policyId,
      policyName: explainPayload.target.name,
      score: explainPayload.target.score,
    })
  );
}
