import {
  CLEARCLEVER_LOGO_SVG,
  getAffiliateBranding,
  type AffiliateBranding,
} from '../constants/affiliateBranding';

export interface AffiliatePageInput {
  apiPublicUrl: string;
  clientUrl: string;
  insurerSlug: string;
  insurerName: string;
  insurerDescription?: string;
  insurerExternalUrl: string;
  policyName: string;
  coverageSummary?: string;
  premiumMonthlyPkr: string;
  premiumYearlyPkr?: string;
  purchaseId: string;
  token: string;
  step: number;
  paymentProcessed: boolean;
  completed: boolean;
  answers: Record<string, unknown>;
  answerFieldsHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function affiliateStyles(branding: AffiliateBranding): string {
  return `
    :root {
      --cc-primary: #2563EB;
      --cc-primary-dark: #1D4ED8;
      --cc-foreground: #0F172A;
      --cc-muted: #64748B;
      --cc-border: #E2E8F0;
      --cc-card: #FFFFFF;
      --cc-background: #F8FAFC;
      --insurer-primary: ${branding.primary};
      --insurer-primary-dark: ${branding.primaryDark};
      --insurer-primary-light: ${branding.primaryLight};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--cc-background);
      color: var(--cc-foreground);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    .page-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .topbar {
      background: var(--cc-card);
      border-bottom: 1px solid var(--cc-border);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(10px);
    }
    .brand-row { display: flex; align-items: center; gap: .85rem; min-width: 0; }
    .brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: .55rem;
      font-family: 'Poppins', 'Inter', sans-serif;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--cc-foreground);
      text-decoration: none;
    }
    .brand-icon {
      width: 2.35rem;
      height: 2.35rem;
      border-radius: .85rem;
      background: var(--cc-primary);
      color: #F8FAFC;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-icon svg { width: 1.2rem; height: 1.2rem; }
    .partnership-pill {
      display: inline-flex;
      align-items: center;
      gap: .65rem;
      padding: .45rem .75rem;
      border-radius: 999px;
      border: 1px solid var(--cc-border);
      background: linear-gradient(135deg, #fff 0%, var(--insurer-primary-light) 100%);
      min-width: 0;
    }
    .partnership-x {
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--cc-muted);
    }
    .insurer-logo {
      color: var(--insurer-primary);
      height: 1.65rem;
      width: auto;
      max-width: 8.5rem;
      display: block;
    }
    .insurer-name {
      font-family: 'Poppins', 'Inter', sans-serif;
      font-weight: 700;
      font-size: .92rem;
      color: var(--insurer-primary-dark);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 10rem;
    }
    .step-nav {
      display: flex;
      justify-content: space-between;
      gap: .75rem;
      margin-top: 1.25rem;
      flex-wrap: wrap;
    }
    .step-nav .btn-back {
      background: transparent;
      color: var(--cc-foreground);
      border: 1px solid var(--cc-border);
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      text-decoration: none;
      font-size: .88rem;
      font-weight: 600;
      color: var(--cc-primary);
      padding: .55rem .9rem;
      border-radius: .75rem;
      border: 1px solid rgba(37, 99, 235, .18);
      background: rgba(37, 99, 235, .06);
      transition: background .15s ease;
    }
    .back-link:hover { background: rgba(37, 99, 235, .12); }
    .hero {
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--insurer-primary) 18%, transparent), transparent 42%),
        linear-gradient(135deg, color-mix(in srgb, var(--cc-primary) 92%, #0F172A) 0%, color-mix(in srgb, var(--insurer-primary-dark) 78%, #0F172A) 100%);
      color: #F8FAFC;
      padding: 2.25rem 1.25rem 2.75rem;
    }
    .hero-inner { max-width: 760px; margin: 0 auto; }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .35rem .75rem;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.18);
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    .hero h1 {
      margin: 0 0 .65rem;
      font-family: 'Poppins', 'Inter', sans-serif;
      font-size: clamp(1.65rem, 4vw, 2.2rem);
      line-height: 1.15;
      letter-spacing: -.02em;
    }
    .hero p {
      margin: 0;
      max-width: 38rem;
      color: rgba(248, 250, 252, .86);
      font-size: .98rem;
    }
    .stepper-wrap {
      max-width: 760px;
      margin: -1.35rem auto 0;
      padding: 0 1rem;
      position: relative;
      z-index: 2;
    }
    .stepper {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: .5rem;
      background: var(--cc-card);
      border: 1px solid var(--cc-border);
      border-radius: 1rem;
      padding: .85rem;
      box-shadow: 0 18px 40px rgba(15, 23, 42, .08);
    }
    .step-pill {
      text-align: center;
      padding: .55rem .35rem;
      border-radius: .75rem;
      font-size: .72rem;
      font-weight: 600;
      color: var(--cc-muted);
      line-height: 1.25;
    }
    .step-pill strong {
      display: block;
      font-size: .8rem;
      margin-bottom: .1rem;
      color: var(--cc-foreground);
    }
    .step-pill.active {
      background: var(--insurer-primary-light);
      color: var(--insurer-primary-dark);
    }
    .step-pill.active strong { color: var(--insurer-primary-dark); }
    .step-pill.done {
      background: rgba(22, 163, 74, .08);
      color: #15803D;
    }
    .step-pill.done strong { color: #15803D; }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      width: 100%;
    }
    .card {
      background: var(--cc-card);
      border: 1px solid var(--cc-border);
      border-radius: 1.15rem;
      padding: 1.35rem 1.35rem 1.5rem;
      box-shadow: 0 10px 30px rgba(15, 23, 42, .05);
      margin-bottom: 1rem;
    }
    .card-head {
      display: flex;
      align-items: flex-start;
      gap: .85rem;
      margin-bottom: 1rem;
    }
    .step-badge {
      width: 2rem;
      height: 2rem;
      border-radius: .7rem;
      background: var(--insurer-primary-light);
      color: var(--insurer-primary-dark);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .82rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .card h2 {
      margin: 0;
      font-family: 'Poppins', 'Inter', sans-serif;
      font-size: 1.08rem;
      letter-spacing: -.01em;
    }
    .card .lead {
      margin: .2rem 0 0;
      color: var(--cc-muted);
      font-size: .9rem;
    }
    .policy-highlight {
      display: grid;
      gap: .85rem;
      padding: 1rem;
      border-radius: .95rem;
      background: linear-gradient(180deg, var(--insurer-primary-light) 0%, #fff 100%);
      border: 1px solid color-mix(in srgb, var(--insurer-primary) 18%, var(--cc-border));
      margin-bottom: 1rem;
    }
    .policy-name {
      margin: 0;
      font-family: 'Poppins', 'Inter', sans-serif;
      font-size: 1.2rem;
      color: var(--insurer-primary-dark);
    }
    .premium-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: .75rem;
    }
    .premium-box {
      background: #fff;
      border: 1px solid var(--cc-border);
      border-radius: .8rem;
      padding: .75rem .85rem;
    }
    .premium-box span {
      display: block;
      font-size: .74rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--cc-muted);
      margin-bottom: .2rem;
      font-weight: 600;
    }
    .premium-box strong {
      font-size: 1rem;
      color: var(--cc-foreground);
    }
    .coverage-line {
      margin: 0;
      font-size: .9rem;
      color: var(--cc-muted);
    }
    .answers-title {
      margin: 0 0 .5rem;
      font-size: .82rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--cc-muted);
    }
    ul.answers {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: .45rem;
    }
    ul.answers li {
      padding: .55rem .7rem;
      border-radius: .7rem;
      background: #F8FAFC;
      border: 1px solid var(--cc-border);
      font-size: .9rem;
    }
    label {
      display: block;
      margin-top: .85rem;
      font-weight: 600;
      font-size: .88rem;
      color: var(--cc-foreground);
    }
    input {
      width: 100%;
      padding: .72rem .85rem;
      margin-top: .35rem;
      border: 1px solid var(--cc-border);
      border-radius: .8rem;
      font-size: 1rem;
      background: #fff;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    input:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--insurer-primary) 55%, var(--cc-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--insurer-primary) 18%, transparent);
    }
    input:invalid { border-color: #F87171; }
    button, .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .4rem;
      margin-top: 1rem;
      background: linear-gradient(135deg, var(--insurer-primary) 0%, var(--insurer-primary-dark) 100%);
      color: #fff;
      border: 0;
      border-radius: .85rem;
      padding: .78rem 1.15rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      font-size: .94rem;
      box-shadow: 0 12px 24px color-mix(in srgb, var(--insurer-primary) 28%, transparent);
      transition: transform .15s ease, opacity .15s ease;
    }
    button:hover, .btn:hover { transform: translateY(-1px); }
    button:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-secondary {
      background: #fff;
      color: var(--insurer-primary-dark);
      border: 1px solid color-mix(in srgb, var(--insurer-primary) 28%, var(--cc-border));
      box-shadow: none;
    }
    .muted { color: var(--cc-muted); font-size: .9rem; line-height: 1.55; }
    .success { color: #15803D; font-weight: 600; }
    .error { color: #B91C1C; font-weight: 600; white-space: pre-wrap; }
    .field-error { color: #B91C1C; font-size: .78rem; margin-top: .25rem; display: none; }
    .field-error.visible { display: block; }
    .secure-note {
      display: flex;
      align-items: center;
      gap: .45rem;
      margin-top: .85rem;
      font-size: .8rem;
      color: var(--cc-muted);
    }
    .footer {
      margin-top: auto;
      border-top: 1px solid var(--cc-border);
      background: #fff;
      padding: 1.1rem 1.25rem;
      text-align: center;
      font-size: .8rem;
      color: var(--cc-muted);
    }
    .footer strong { color: var(--cc-foreground); }
    @media (max-width: 640px) {
      .stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .partnership-pill { max-width: 100%; }
      .insurer-logo { max-width: 6.5rem; }
    }
  `;
}

function stepPill(label: string, sub: string, state: 'active' | 'done' | ''): string {
  const cls = ['step-pill', state].filter(Boolean).join(' ');
  return `<div class="${cls}"><strong>${label}</strong>${sub}</div>`;
}

export function renderAffiliateErrorPage(title: string, message: string, clientUrl: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeUrl = escapeHtml(clientUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClearClever — ${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      font-family: 'Inter', system-ui, sans-serif;
      background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
      color: #F8FAFC;
    }
    .card {
      max-width: 460px;
      width: 100%;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 1.25rem;
      padding: 2rem 1.75rem;
      text-align: center;
      backdrop-filter: blur(8px);
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: .6rem;
      margin-bottom: 1.25rem;
      font-family: 'Poppins', sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
    }
    .logo-icon {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: .8rem;
      background: #2563EB;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon svg { width: 1.2rem; height: 1.2rem; }
    h1 { font-family: 'Poppins', sans-serif; font-size: 1.3rem; margin: 0 0 .85rem; }
    p { color: #CBD5E1; line-height: 1.6; margin: 0 0 1.5rem; }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #2563EB;
      color: #fff;
      padding: .8rem 1.2rem;
      border-radius: .85rem;
      text-decoration: none;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-icon">${CLEARCLEVER_LOGO_SVG}</span>
      ClearClever
    </div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="${safeUrl}/dashboard/compare">Return to ClearClever</a>
  </div>
</body>
</html>`;
}

function stepUrl(
  input: AffiliatePageInput,
  step: number
): string {
  const url = new URL(`${input.apiPublicUrl}/affiliate/${input.insurerSlug}`);
  url.searchParams.set('purchaseId', input.purchaseId);
  url.searchParams.set('token', input.token);
  url.searchParams.set('step', String(step));
  return url.toString();
}

function stepPillState(
  pill: number,
  current: number,
  input: AffiliatePageInput
): 'active' | 'done' | '' {
  if (pill < current) return 'done';
  if (pill === current) return 'active';
  if (pill === 2 && current === 1) return '';
  if (pill === 3 && input.paymentProcessed) return current === 3 ? 'active' : 'done';
  if (pill === 4 && input.completed) return 'done';
  if (pill === 4 && input.paymentProcessed && current === 4) return 'active';
  return '';
}

export function renderAffiliatePage(input: AffiliatePageInput): string {
  const branding = getAffiliateBranding(input.insurerSlug, input.insurerName);
  const completeUrl = `${input.apiPublicUrl}/api/purchase/complete?purchaseId=${encodeURIComponent(input.purchaseId)}&token=${encodeURIComponent(input.token)}`;
  const backUrl = `${input.clientUrl}/dashboard/compare`;
  const currentStep = input.step;

  const insurerName = escapeHtml(input.insurerName);
  const policyName = escapeHtml(input.policyName);
  const coverageSummary = input.coverageSummary ? escapeHtml(input.coverageSummary) : '';
  const insurerDescription = input.insurerDescription
    ? escapeHtml(input.insurerDescription)
    : `Complete your secure checkout with ${insurerName} through ClearClever.`;

  const yearlyPremium = input.premiumYearlyPkr
    ? `<div class="premium-box"><span>Yearly premium</span><strong>PKR ${escapeHtml(input.premiumYearlyPkr)}</strong></div>`
    : '';

  const step1Content =
    currentStep === 1
      ? `<article class="card">
        <div class="card-head">
          <span class="step-badge">1</span>
          <div>
            <h2>Step 1 — Review your policy</h2>
            <p class="lead">Confirm your selected plan and questionnaire answers. Edit any field before continuing.</p>
          </div>
        </div>

        <div class="policy-highlight">
          <h3 class="policy-name">${policyName}</h3>
          <div class="premium-grid">
            <div class="premium-box">
              <span>Monthly premium</span>
              <strong>PKR ${escapeHtml(input.premiumMonthlyPkr)}</strong>
            </div>
            ${yearlyPremium}
          </div>
          ${coverageSummary ? `<p class="coverage-line"><strong>Coverage:</strong> ${coverageSummary}</p>` : ''}
        </div>

        <p class="answers-title">Your questionnaire responses</p>
        <form id="answers-form" class="answers-form">
          ${input.answerFieldsHtml}
          <button type="submit" class="btn btn-secondary" id="save-answers-btn">Save changes</button>
        </form>
        <p id="answers-msg" class="muted"></p>

        <div class="step-nav">
          <a class="btn btn-back" href="${escapeHtml(backUrl)}">← Back to compare</a>
          <a class="btn" href="${escapeHtml(stepUrl(input, 2))}">Continue to payment →</a>
        </div>
      </article>`
      : '';

  const step2Content =
    currentStep === 2
      ? `<article class="card">
        <div class="card-head">
          <span class="step-badge">2</span>
          <div>
            <h2>Step 2 — Simulate payment</h2>
            <p class="lead">Enter card details as you would with ${insurerName}. Fields are validated but not charged.</p>
          </div>
        </div>

        <form id="payment-form" novalidate>
          <label>Cardholder name (as on card)
            <input name="cardholderName" required minlength="2" maxlength="120" autocomplete="cc-name" placeholder="Ali Khan" />
            <span class="field-error" data-for="cardholderName">Enter the name printed on your card.</span>
          </label>
          <label>Last 4 digits of card
            <input name="cardLast4" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="1234" />
            <span class="field-error" data-for="cardLast4">Enter exactly 4 digits.</span>
          </label>
          <label>Expiry date (MM/YY)
            <input name="cardExpiry" required pattern="(0[1-9]|1[0-2])/[0-9]{2}" placeholder="12/28" maxlength="5" />
            <span class="field-error" data-for="cardExpiry">Use MM/YY format, e.g. 12/28.</span>
          </label>
          <button type="submit" id="pay-btn" class="btn" ${input.paymentProcessed ? 'disabled' : ''}>
            ${input.paymentProcessed ? 'Payment already processed' : 'Process payment securely'}
          </button>
        </form>
        <p class="secure-note">🔒 Simulated payment only — your card is never charged on ClearClever.</p>
        <p id="payment-msg" class="${input.paymentProcessed ? 'success' : 'muted'}">
          ${input.paymentProcessed ? 'Payment processed. Continue to the insurer step.' : ''}
        </p>

        <div class="step-nav">
          <a class="btn btn-back" href="${escapeHtml(stepUrl(input, 1))}">← Back to review</a>
          ${
            input.paymentProcessed
              ? `<a class="btn" href="${escapeHtml(stepUrl(input, 3))}">Continue to insurer →</a>`
              : '<span class="muted">Process payment to continue</span>'
          }
        </div>
      </article>`
      : '';

  const step3Content =
    currentStep === 3
      ? `<article class="card">
        <div class="card-head">
          <span class="step-badge">3</span>
          <div>
            <h2>Step 3 — Visit insurer (optional)</h2>
            <p class="lead">Open ${insurerName}'s website in a new tab to review official policy documents.</p>
          </div>
        </div>
        ${input.insurerDescription ? `<p class="lead">${insurerDescription}</p>` : ''}
        <a class="btn btn-secondary" href="${escapeHtml(input.insurerExternalUrl)}" target="_blank" rel="noopener noreferrer">Open ${insurerName} website</a>

        <div class="step-nav">
          <a class="btn btn-back" href="${escapeHtml(stepUrl(input, 2))}">← Back to payment</a>
          <a class="btn" href="${escapeHtml(stepUrl(input, 4))}">Continue to complete →</a>
        </div>
      </article>`
      : '';

  const step4Content =
    currentStep === 4
      ? `<article class="card">
        <div class="card-head">
          <span class="step-badge">4</span>
          <div>
            <h2>Step 4 — Complete on ClearClever</h2>
            <p class="lead">Finalize your purchase and return to your dashboard timeline.</p>
          </div>
        </div>
        <a class="btn" id="complete-btn" href="${escapeHtml(completeUrl)}">Complete on ClearClever</a>
        ${input.completed ? '<p class="success">This purchase is already completed.</p>' : ''}
        ${!input.paymentProcessed ? '<p class="muted" id="complete-hint">Complete step 2 before finishing.</p>' : ''}

        <div class="step-nav">
          <a class="btn btn-back" href="${escapeHtml(stepUrl(input, 3))}">← Back to insurer</a>
        </div>
      </article>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${insurerName} — ClearClever Checkout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
  <style>${affiliateStyles(branding)}</style>
</head>
<body>
  <div class="page-shell">
    <header class="topbar">
      <div class="brand-row">
        <a class="brand-lockup" href="${escapeHtml(backUrl)}">
          <span class="brand-icon">${CLEARCLEVER_LOGO_SVG}</span>
          ClearClever
        </a>
        <div class="partnership-pill" aria-label="ClearClever partnership with ${insurerName}">
          <span class="partnership-x">×</span>
          <span class="insurer-logo">${branding.logoSvg}</span>
          <span class="insurer-name">${insurerName}</span>
        </div>
      </div>
      <a class="back-link" href="${escapeHtml(backUrl)}">← Back to compare</a>
    </header>

    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">Secure partner checkout · Step ${currentStep} of 4</div>
        <h1>Finish your policy with ${insurerName}</h1>
        <p>${insurerDescription} Payment is simulated for your FYP demo — no real charge.</p>
      </div>
    </section>

    <div class="stepper-wrap">
      <div class="stepper" aria-label="Checkout progress">
        ${stepPill('1', 'Review', stepPillState(1, currentStep, input))}
        ${stepPill('2', 'Payment', stepPillState(2, currentStep, input))}
        ${stepPill('3', 'Insurer', stepPillState(3, currentStep, input))}
        ${stepPill('4', 'Complete', stepPillState(4, currentStep, input))}
      </div>
    </div>

    <main>
      <noscript>
        <div class="card"><p class="error">JavaScript is required to simulate payment on this page. Enable JavaScript or contact support.</p></div>
      </noscript>

      ${step1Content}
      ${step2Content}
      ${step3Content}
      ${step4Content}
    </main>

    <footer class="footer">
      <strong>ClearClever</strong> × <strong>${insurerName}</strong> — trusted insurance comparison for Pakistan
    </footer>
  </div>

  <script>
    const purchaseId = ${JSON.stringify(input.purchaseId)};
    const token = ${JSON.stringify(input.token)};
    const apiBase = ${JSON.stringify(input.apiPublicUrl)};
    const step3Url = ${JSON.stringify(stepUrl(input, 3))};
    const form = document.getElementById('payment-form');
    const payBtn = document.getElementById('pay-btn');
    const paymentMsg = document.getElementById('payment-msg');
    const completeBtn = document.getElementById('complete-btn');
    const answersForm = document.getElementById('answers-form');
    const answersMsg = document.getElementById('answers-msg');
    let paymentDone = ${input.paymentProcessed ? 'true' : 'false'};

    function showFieldErrors(errors) {
      document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
      if (!errors || !errors.length) return;
      errors.forEach(msg => {
        const match = msg.match(/^([^:]+):\\s*(.+)$/);
        if (match) {
          const el = document.querySelector('.field-error[data-for="' + match[1].trim() + '"]');
          if (el) { el.textContent = match[2].trim(); el.classList.add('visible'); }
        }
      });
    }

    if (completeBtn) {
      completeBtn.addEventListener('click', (e) => {
        if (!paymentDone) {
          e.preventDefault();
          if (paymentMsg) {
            paymentMsg.textContent = 'Please process payment in step 2 before completing.';
            paymentMsg.className = 'error';
          }
        }
      });
    }

    answersForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const saveBtn = document.getElementById('save-answers-btn');
      if (saveBtn) saveBtn.disabled = true;
      if (answersMsg) {
        answersMsg.textContent = 'Saving…';
        answersMsg.className = 'muted';
      }
      const data = Object.fromEntries(new FormData(answersForm).entries());
      try {
        const res = await fetch(apiBase + '/api/purchase/' + purchaseId + '/answers', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-checkout-token': token,
          },
          body: JSON.stringify({ answers: data }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || 'Could not save answers.');
        if (answersMsg) {
          answersMsg.textContent = 'Changes saved.';
          answersMsg.className = 'success';
        }
      } catch (err) {
        if (answersMsg) {
          answersMsg.textContent = err.message || 'Save failed';
          answersMsg.className = 'error';
        }
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      payBtn.disabled = true;
      paymentMsg.textContent = 'Processing payment…';
      paymentMsg.className = 'muted';
      showFieldErrors([]);

      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch(apiBase + '/api/purchase/' + purchaseId + '/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-checkout-token': token,
          },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          showFieldErrors(json.errors || []);
          throw new Error(json.message || 'We could not process your payment details.');
        }
        paymentMsg.textContent = 'Payment processed successfully. Continuing to insurer step…';
        paymentMsg.className = 'success';
        payBtn.textContent = 'Payment already processed';
        paymentDone = true;
        window.location.assign(step3Url);
      } catch (err) {
        paymentMsg.textContent = err.message || 'Payment failed';
        paymentMsg.className = 'error';
        payBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
