export type AssistantUsageRoute = 'chat' | 'explain' | 'probe';

export interface AssistantUsageEvent {
  at: string;
  route: AssistantUsageRoute;
  ok: boolean;
  latencyMs: number;
  model: string;
  statusCode?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
}

export interface AssistantUsageSummary {
  serverStartedAt: string;
  lastRequestAt?: string;
  totalApiCalls: number;
  successfulApiCalls: number;
  failedApiCalls: number;
  rateLimitErrors: number;
  chatApiCalls: number;
  explainApiCalls: number;
  probeApiCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  requestsLastMinute: number;
  recentErrors: Array<{ at: string; route: AssistantUsageRoute; message: string }>;
}

const SERVER_STARTED_AT = new Date().toISOString();
const MAX_RECENT_ERRORS = 8;
const MAX_EVENT_HISTORY = 500;

let events: AssistantUsageEvent[] = [];

export function resetAssistantUsageTracker(): void {
  events = [];
}

export function recordAssistantUsage(event: Omit<AssistantUsageEvent, 'at'> & { at?: string }): void {
  const entry: AssistantUsageEvent = {
    ...event,
    at: event.at ?? new Date().toISOString(),
  };
  events.push(entry);
  if (events.length > MAX_EVENT_HISTORY) {
    events = events.slice(-MAX_EVENT_HISTORY);
  }
}

export function getAssistantUsageSummary(now = Date.now()): AssistantUsageSummary {
  const oneMinuteAgo = now - 60_000;
  const recentErrors: AssistantUsageSummary['recentErrors'] = [];

  let totalApiCalls = 0;
  let successfulApiCalls = 0;
  let failedApiCalls = 0;
  let rateLimitErrors = 0;
  let chatApiCalls = 0;
  let explainApiCalls = 0;
  let probeApiCalls = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let requestsLastMinute = 0;
  let lastRequestAt: string | undefined;

  for (const event of events) {
    totalApiCalls += 1;
    lastRequestAt = event.at;

    if (event.ok) {
      successfulApiCalls += 1;
    } else {
      failedApiCalls += 1;
      if (event.statusCode === 429) {
        rateLimitErrors += 1;
      }
      if (event.error) {
        recentErrors.push({
          at: event.at,
          route: event.route,
          message: event.error,
        });
      }
    }

    if (event.route === 'chat') chatApiCalls += 1;
    if (event.route === 'explain') explainApiCalls += 1;
    if (event.route === 'probe') probeApiCalls += 1;

    totalPromptTokens += event.promptTokens ?? 0;
    totalCompletionTokens += event.completionTokens ?? 0;
    totalTokens += event.totalTokens ?? 0;

    if (new Date(event.at).getTime() >= oneMinuteAgo) {
      requestsLastMinute += 1;
    }
  }

  return {
    serverStartedAt: SERVER_STARTED_AT,
    lastRequestAt,
    totalApiCalls,
    successfulApiCalls,
    failedApiCalls,
    rateLimitErrors,
    chatApiCalls,
    explainApiCalls,
    probeApiCalls,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    requestsLastMinute,
    recentErrors: recentErrors.slice(-MAX_RECENT_ERRORS).reverse(),
  };
}
