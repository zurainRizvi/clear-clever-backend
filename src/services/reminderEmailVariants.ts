import type { PremiumCadenceOffset } from '../constants/reminders';
import type { ReminderScenario } from '../constants/reminders';
import { clientAppUrls, resolveClientBaseUrl } from './clientUrls';
import { EMAIL_HERO_IMAGES } from './emailAssets';
import type { ClearCleverEmailContent } from './clearCleverEmailLayout';

export { resolveClientBaseUrl } from './clientUrls';

const SHARED_FEATURES = {
  coverage: {
    emoji: '🛡️',
    title: 'Comprehensive coverage',
    description: 'Tailored protection for your needs',
    iconBackground: '#EEF4FF',
  },
  claims: {
    emoji: '⚡',
    title: 'Fast claims',
    description: 'Quick support whenever needed',
    iconBackground: '#ECFDF3',
  },
  transparency: {
    emoji: '📄',
    title: 'Policy transparency',
    description: 'All details in one place',
    iconBackground: '#F5F3FF',
  },
  secure: {
    emoji: '🔒',
    title: 'Secure & reliable',
    description: 'Enterprise-level protection',
    iconBackground: '#FFF4EC',
  },
} as const;

function premiumVariant(
  offset: PremiumCadenceOffset,
  policyName: string,
  dueDate: Date,
  base: string
): ClearCleverEmailContent {
  const links = clientAppUrls(base);
  const dueStr = dueDate.toISOString().slice(0, 10);

  if (offset === 10) {
    return {
      preheader: `Premium for ${policyName} is due in 10 days (${dueStr})`,
      headerLabel: 'Premium reminder',
      badge: 'Due in 10 days',
      heading: 'Plan ahead for your premium',
      highlightWord: 'premium',
      highlightColor: '#7DD3FC',
      paragraph: `Your payment for ${policyName} is due in 10 days (${dueStr} UTC). Set a reminder or pay early to keep uninterrupted coverage.`,
      heroGradient: 'linear-gradient(135deg, #001B6D 0%, #0037D6 100%)',
      heroShadow: '0 25px 60px rgba(0, 32, 120, 0.25)',
      heroImageUrl: EMAIL_HERO_IMAGES.premiumEarly,
      heroImageAlt: 'Planning premium payment',
      policyName,
      primaryCta: { label: 'Review billing', href: links.purchases },
      secondaryCta: { label: 'Visit dashboard', href: links.dashboard },
      features: [
        SHARED_FEATURES.coverage,
        { emoji: '📅', title: 'Due date clarity', description: `Due ${dueStr} UTC`, iconBackground: '#E0F2FE' },
        SHARED_FEATURES.transparency,
        SHARED_FEATURES.secure,
      ],
    };
  }

  if (offset === 7) {
    return {
      preheader: `Premium due in 7 days — ${policyName}`,
      headerLabel: 'Premium reminder',
      badge: 'Due in 7 days',
      heading: 'Your premium is coming up',
      highlightWord: 'premium',
      highlightColor: '#6EE7B7',
      paragraph: `One week until your ${policyName} premium is due (${dueStr} UTC). Complete payment on time to avoid any coverage gap.`,
      heroGradient: 'linear-gradient(135deg, #0B3D2E 0%, #047857 55%, #0E7490 100%)',
      heroShadow: '0 25px 60px rgba(4, 120, 87, 0.28)',
      heroImageUrl: EMAIL_HERO_IMAGES.premiumMid,
      heroImageAlt: 'Upcoming premium payment',
      policyName,
      primaryCta: { label: 'Pay premium', href: links.purchases },
      secondaryCta: { label: 'View policy', href: links.dashboard },
      features: [
        SHARED_FEATURES.coverage,
        SHARED_FEATURES.claims,
        { emoji: '💳', title: 'Easy checkout', description: 'Manage payments in one tap', iconBackground: '#ECFEFF' },
        SHARED_FEATURES.secure,
      ],
    };
  }

  if (offset === 3) {
    return {
      preheader: `Only 3 days left — premium for ${policyName}`,
      headerLabel: 'Urgent reminder',
      badge: 'Due in 3 days',
      heading: 'Last call before due date',
      highlightWord: 'due date',
      highlightColor: '#FCD34D',
      paragraph: `Your premium for ${policyName} is due in 3 days (${dueStr} UTC). Pay now to keep your policy active without interruption.`,
      heroGradient: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 50%, #EA580C 100%)',
      heroShadow: '0 25px 60px rgba(194, 65, 12, 0.3)',
      heroImageUrl: EMAIL_HERO_IMAGES.premiumUrgent,
      heroImageAlt: 'Urgent premium reminder',
      policyName,
      primaryCta: { label: 'Pay now', href: links.purchases },
      secondaryCta: { label: 'Billing details', href: links.purchases },
      features: [
        { emoji: '⏰', title: '3-day window', description: 'Act before coverage lapses', iconBackground: '#FEF3C7' },
        SHARED_FEATURES.coverage,
        SHARED_FEATURES.transparency,
        SHARED_FEATURES.secure,
      ],
    };
  }

  return {
    preheader: `Premium due today for ${policyName}`,
    headerLabel: 'Due today',
    badge: 'Due today',
    heading: 'Premium due today',
    highlightWord: 'today',
    highlightColor: '#FCA5A5',
    paragraph: `Your premium for ${policyName} is due today (${dueStr} UTC). Complete payment immediately to maintain active coverage.`,
    heroGradient: 'linear-gradient(135deg, #450A0A 0%, #B91C1C 55%, #DC2626 100%)',
    heroShadow: '0 25px 60px rgba(185, 28, 28, 0.32)',
    heroImageUrl: EMAIL_HERO_IMAGES.premiumDue,
    heroImageAlt: 'Premium due today',
    policyName,
    primaryCta: { label: 'Pay premium now', href: links.purchases },
    secondaryCta: { label: 'Contact support', href: links.contactSupport },
    features: [
      { emoji: '🚨', title: 'Action required', description: 'Payment due today', iconBackground: '#FEE2E2' },
      SHARED_FEATURES.coverage,
      SHARED_FEATURES.claims,
      SHARED_FEATURES.secure,
    ],
  };
}

export function reminderEmailContent(
  scenario: ReminderScenario,
  context: { policyName: string; dueDate?: Date; offset?: PremiumCadenceOffset },
  clientBase = resolveClientBaseUrl()
): ClearCleverEmailContent {
  const links = clientAppUrls(clientBase);
  const policyName = context.policyName;

  switch (scenario) {
    case 'premium_t10':
      return premiumVariant(10, policyName, context.dueDate!, clientBase);
    case 'premium_t7':
      return premiumVariant(7, policyName, context.dueDate!, clientBase);
    case 'premium_t3':
      return premiumVariant(3, policyName, context.dueDate!, clientBase);
    case 'premium_due':
      return premiumVariant(0, policyName, context.dueDate!, clientBase);

    case 'claim_followup_7d':
      return {
        preheader: `Claim update for ${policyName} — still in review`,
        headerLabel: 'Claim follow-up',
        badge: 'Claim in review',
        heading: 'We are still on your claim',
        highlightWord: 'claim',
        highlightColor: '#A78BFA',
        paragraph: `Your claim for ${policyName} has been under review for over a week. We are actively following up and will notify you in-app the moment there is an update.`,
        heroGradient: 'linear-gradient(135deg, #312E81 0%, #5B21B6 50%, #7C3AED 100%)',
        heroShadow: '0 25px 60px rgba(91, 33, 182, 0.28)',
        heroImageUrl: EMAIL_HERO_IMAGES.claim,
        heroImageAlt: 'Claim documents review',
        policyName,
        primaryCta: { label: 'Track claim status', href: links.claims },
        secondaryCta: { label: 'Visit dashboard', href: links.dashboard },
        features: [
          { emoji: '📎', title: 'Documents on file', description: 'Everything saved securely', iconBackground: '#EDE9FE' },
          SHARED_FEATURES.claims,
          { emoji: '💬', title: 'Live updates', description: 'Alerts inside ClearClever', iconBackground: '#E0E7FF' },
          SHARED_FEATURES.secure,
        ],
        footerSupport: 'Questions about your claim? Our team can help.',
      };

    case 'approval_pending_insurer':
      return {
        preheader: `${policyName} is awaiting your approval`,
        headerLabel: 'Insurer action',
        badge: 'Pending approval',
        heading: 'A policy needs your review',
        highlightWord: 'review',
        highlightColor: '#38BDF8',
        paragraph: `${policyName} is still pending platform approval. Review details, verify coverage terms, and approve or request changes from your insurer dashboard.`,
        heroGradient: 'linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #0284C7 100%)',
        heroShadow: '0 25px 60px rgba(3, 105, 161, 0.28)',
        heroImageUrl: EMAIL_HERO_IMAGES.approval,
        heroImageAlt: 'Policy approval workspace',
        policyName,
        primaryCta: { label: 'Review policy', href: links.providerPolicies },
        secondaryCta: { label: 'Insurer dashboard', href: links.providerDashboard },
        features: [
          { emoji: '✅', title: 'Quick approval', description: 'Approve compliant listings faster', iconBackground: '#E0F2FE' },
          { emoji: '📊', title: 'Listing insights', description: 'See performance at a glance', iconBackground: '#F0FDF4' },
          SHARED_FEATURES.transparency,
          SHARED_FEATURES.secure,
        ],
        footerSupport: 'Need help with policy review? Contact platform support.',
      };

    case 'policy_completion_d7':
      return {
        preheader: `One-week check-in for ${policyName}`,
        headerLabel: 'Policy check-in',
        badge: 'One-week check-in',
        heading: 'How is your coverage going?',
        highlightWord: 'coverage',
        highlightColor: '#4DA3FF',
        paragraph: `It has been one week since you completed ${policyName}. Review your policy details, track claims, and access your dashboard anytime.`,
        heroGradient: 'linear-gradient(135deg, #001B6D 0%, #0037D6 100%)',
        heroShadow: '0 25px 60px rgba(0, 32, 120, 0.25)',
        heroImageUrl: EMAIL_HERO_IMAGES.completion,
        heroImageAlt: 'Home protected with ClearClever',
        policyName,
        primaryCta: { label: 'View policy details', href: links.purchases },
        secondaryCta: { label: 'Visit dashboard', href: links.dashboard },
        features: [
          SHARED_FEATURES.coverage,
          SHARED_FEATURES.claims,
          SHARED_FEATURES.transparency,
          SHARED_FEATURES.secure,
        ],
      };

    default:
      return {
        preheader: 'You have a new ClearClever reminder',
        headerLabel: 'Reminder',
        badge: 'Notification',
        heading: 'You have a new update',
        highlightWord: 'update',
        paragraph: 'Sign in to ClearClever to view the latest activity on your account.',
        heroGradient: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
        heroShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
        heroImageUrl: EMAIL_HERO_IMAGES.completion,
        heroImageAlt: 'ClearClever',
        primaryCta: { label: 'Open dashboard', href: links.dashboard },
        features: [
          SHARED_FEATURES.coverage,
          SHARED_FEATURES.claims,
          SHARED_FEATURES.transparency,
          SHARED_FEATURES.secure,
        ],
      };
  }
}
