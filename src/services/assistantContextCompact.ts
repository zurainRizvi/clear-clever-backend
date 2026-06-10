import type { AssistantContext } from './assistantContextService';

const MAX_COVERAGE_CHARS = 120;
const MAX_MATCH_REASONS = 2;

function truncateText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Keep Gemini prompts smaller to reduce quota pressure and latency. */
export function compactAssistantContext(
  context: AssistantContext,
  options?: { followUp?: boolean }
): AssistantContext {
  const followUp = options?.followUp === true;

  const compact: AssistantContext = {
    ...context,
    platformFaq: followUp ? [] : context.platformFaq.slice(0, 3),
    categories: followUp ? [] : context.categories,
    questionnaireSummaries: context.questionnaireSummaries?.slice(0, followUp ? 2 : 4),
    topRecommendations: context.topRecommendations?.slice(0, followUp ? 2 : 4).map((group) => ({
      ...group,
      policies: group.policies.slice(0, followUp ? 2 : 3).map((policy) => ({
        ...policy,
        coverageSummary: truncateText(policy.coverageSummary, MAX_COVERAGE_CHARS),
        matchReasons: policy.matchReasons.slice(0, MAX_MATCH_REASONS),
      })),
    })),
    recentPurchases: context.recentPurchases?.slice(0, followUp ? 3 : 5),
    openClaims: context.openClaims?.slice(0, followUp ? 3 : 5),
  };

  if (compact.insurerSummary) {
    compact.insurerSummary = {
      ...compact.insurerSummary,
      policies: compact.insurerSummary.policies.slice(0, followUp ? 5 : 8),
      recentLeads: compact.insurerSummary.recentLeads.slice(0, followUp ? 4 : 6),
    };
  }

  if (followUp && compact.staffSummary) {
    compact.staffSummary = {
      activeUsers: compact.staffSummary.activeUsers,
      pendingPolicyApprovals: compact.staffSummary.pendingPolicyApprovals,
      openSupportInquiries: compact.staffSummary.openSupportInquiries,
    };
  }

  return compact;
}
