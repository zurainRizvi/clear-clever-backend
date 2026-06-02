import type { AssistantContext } from './assistantContextService';

/** Keep Gemini prompts smaller to reduce quota pressure and latency. */
export function compactAssistantContext(context: AssistantContext): AssistantContext {
  const compact: AssistantContext = {
    ...context,
    platformFaq: context.platformFaq.slice(0, 4),
    questionnaireSummaries: context.questionnaireSummaries?.slice(0, 4),
    topRecommendations: context.topRecommendations?.slice(0, 4).map((group) => ({
      ...group,
      policies: group.policies.slice(0, 3),
    })),
    recentPurchases: context.recentPurchases?.slice(0, 5),
    openClaims: context.openClaims?.slice(0, 5),
  };

  if (compact.insurerSummary) {
    compact.insurerSummary = {
      ...compact.insurerSummary,
      policies: compact.insurerSummary.policies.slice(0, 8),
      recentLeads: compact.insurerSummary.recentLeads.slice(0, 6),
    };
  }

  return compact;
}
