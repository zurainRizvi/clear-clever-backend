import type { AssistantAudience } from './assistantContextService';

export interface FaqBypassInput {
  message: string;
  audience: AssistantAudience;
  hasAttachments: boolean;
  hasPriorAssistantReply: boolean;
  addressing?: { fullName: string; firstName: string };
}

interface FaqEntry {
  id: string;
  patterns: RegExp[];
  audiences?: AssistantAudience[];
  reply: string | ((input: FaqBypassInput) => string);
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'what-is-clearclever',
    patterns: [
      /^what is clearclever/,
      /^what s clearclever/,
      /^tell me about clearclever/,
      /^who is clearclever/,
      /^what does clearclever do/,
    ],
    reply: `**ClearClever** is an insurance comparison platform for Pakistan.

We help you compare **home, auto, life, pet**, and other policies from multiple insurers in one place.

Our recommendations use a **rule-based scoring engine** (affordability, coverage fit, features) — not guesses. When you are ready to buy, we send you to the insurer's checkout and track your purchase status.

**Sign in** to get personalized scores from your questionnaire.`,
  },
  {
    id: 'how-recommendations-work',
    patterns: [
      /^how (do|does) (the )?recommendations work/,
      /^how (is|are) (policies |policy )?scored/,
      /^how does scoring work/,
      /^how do you rank policies/,
      /^how are policies ranked/,
    ],
    reply: `ClearClever ranks policies with a **hybrid recommender**:

- **Rule-based scoring** from your questionnaire (budget, coverage needs, property type, etc.)
- **ML ranker** when a trained model exists for the category

Each policy gets a **match score** and short **match reasons** tied to your answers. The assistant never invents scores — they come from your saved questionnaire.

Complete a category questionnaire, then open **Compare** to see your top matches.`,
  },
  {
    id: 'how-to-purchase',
    patterns: [
      /^how (do i|to) (buy|purchase|get) (a )?(policy|insurance)/,
      /^how does purchasing work/,
      /^how do i buy through clearclever/,
    ],
    reply: `**How purchasing works on ClearClever:**

1. Complete the questionnaire for a category (home, auto, life, pet).
2. Review your ranked recommendations on **Compare**.
3. Choose a policy — you are redirected to the **insurer's affiliate checkout**.
4. After payment, return to ClearClever; we track status and send reminders.

ClearClever does not sell policies directly — the insurer fulfills coverage.`,
  },
  {
    id: 'categories',
    patterns: [
      /^what (types of |kinds of )?insurance/,
      /^what categories/,
      /^which insurance categories/,
      /^what can i compare/,
    ],
    reply: `ClearClever supports five categories:

- **Home** — apartments, houses, contents
- **Auto** — cars, bikes, commercial vehicles
- **Life** — term and family protection
- **Pet** — dogs, cats, and other pets
- **Others** — additional products as insurers list them

Pick a category on the homepage to start the questionnaire.`,
  },
  {
    id: 'sign-in-benefits',
    patterns: [
      /^why (should i|do i need to) sign in/,
      /^benefits of signing in/,
      /^what do i get if i sign in/,
    ],
    audiences: ['public'],
    reply: `**Why sign in to ClearClever:**

- Save questionnaire answers and get **personalized policy scores**
- See **AI explanations** for why a policy matches you
- Track **purchases** and **claims** in one dashboard
- Chat with the assistant using your real account context

Creating an account is free — use **Sign up** with email and OTP verification.`,
  },
  {
    id: 'claims-process',
    patterns: [
      /^how (do i|to) (file|submit|make) a claim/,
      /^how do claims work/,
      /^what is the claims process/,
    ],
    reply: `**Filing a claim on ClearClever:**

1. Sign in and open **Claims** from your dashboard.
2. Link the claim to a **purchased policy**.
3. Describe the incident and upload evidence (photos, PDFs).
4. Our **AI claims intelligence** helps summarize damage and consistency for the insurer review.
5. Track status as the insurer processes your request.

Always confirm final coverage decisions with your insurer.`,
  },
];

function greetPrefix(input: FaqBypassInput): string {
  if (input.hasPriorAssistantReply) return '';
  if (input.addressing?.fullName) {
    return `Hello, **${input.addressing.fullName}**!\n\n`;
  }
  return '';
}

/** Return a static Markdown reply for common FAQ-style questions (no Gemini call). */
export function tryAssistantFaqBypass(input: FaqBypassInput): string | undefined {
  if (input.hasAttachments) return undefined;

  const normalized = normalizeMessage(input.message);
  if (normalized.length < 4 || normalized.length > 200) return undefined;

  for (const entry of FAQ_ENTRIES) {
    if (entry.audiences && !entry.audiences.includes(input.audience)) {
      continue;
    }
    if (!entry.patterns.some((pattern) => pattern.test(normalized))) {
      continue;
    }

    const body = typeof entry.reply === 'function' ? entry.reply(input) : entry.reply;
    return `${greetPrefix(input)}${body}`;
  }

  return undefined;
}

/** @internal test helper */
export function resetAssistantFaqBypassForTests(): void {
  // Reserved for future TTL/state; no-op today.
}
