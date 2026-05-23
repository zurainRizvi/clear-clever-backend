export interface AffiliatePageInput {
  apiPublicUrl: string;
  clientUrl: string;
  insurerSlug: string;
  insurerName: string;
  insurerExternalUrl: string;
  policyName: string;
  premiumMonthlyPkr: string;
  purchaseId: string;
  token: string;
  paymentProcessed: boolean;
  completed: boolean;
  answerSummaryHtml: string;
}

export function renderAffiliateErrorPage(title: string, message: string, clientUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClearClever — ${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { max-width: 480px; background: #111827; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 2rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem; }
    a { display: inline-block; background: #2563eb; color: #fff; padding: .75rem 1.25rem; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${clientUrl}/dashboard/compare">Return to ClearClever</a>
  </div>
</body>
</html>`;
}

export function renderAffiliatePage(input: AffiliatePageInput): string {
  const completeUrl = `${input.apiPublicUrl}/api/purchase/complete?purchaseId=${encodeURIComponent(input.purchaseId)}&token=${encodeURIComponent(input.token)}`;
  const backUrl = `${input.clientUrl}/dashboard/compare`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.insurerName} — ClearClever</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f4f7fb; color: #0f172a; }
    header { background: #0b1120; color: #f8fafc; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    header a { color: #93c5fd; text-decoration: none; font-size: .9rem; font-weight: 600; }
    header a:hover { text-decoration: underline; }
    main { max-width: 720px; margin: 1.5rem auto; padding: 0 1rem 3rem; }
    .card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 8px 24px rgba(15,23,42,.08); margin-bottom: 1rem; border: 1px solid #e2e8f0; }
    h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
    h2 { font-size: 1.1rem; margin: 0 0 .75rem; }
    .step { border-left: 4px solid #2563eb; padding-left: 1rem; margin: 1.25rem 0; }
    label { display: block; margin-top: .75rem; font-weight: 600; font-size: .9rem; }
    input { width: 100%; padding: .6rem .75rem; margin-top: .25rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; font-size: 1rem; }
    input:invalid { border-color: #f87171; }
    button, .btn { display: inline-block; margin-top: 1rem; background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: .7rem 1rem; font-weight: 600; cursor: pointer; text-decoration: none; font-size: .95rem; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .muted { color: #64748b; font-size: .9rem; line-height: 1.5; }
    .success { color: #15803d; font-weight: 600; }
    .error { color: #b91c1c; font-weight: 600; white-space: pre-wrap; }
    ul { padding-left: 1.2rem; line-height: 1.6; }
    .field-error { color: #b91c1c; font-size: .8rem; margin-top: .25rem; display: none; }
    .field-error.visible { display: block; }
  </style>
</head>
<body>
  <header>
    <span>ClearClever × ${input.insurerName}</span>
    <a href="${backUrl}">← Back to ClearClever</a>
  </header>
  <main>
    <noscript>
      <div class="card"><p class="error">JavaScript is required to simulate payment on this page. Enable JavaScript or contact support.</p></div>
    </noscript>

    <div class="card">
      <h1>Secure checkout with ${input.insurerName}</h1>
      <p class="muted">Payment is simulated for your FYP demo — no real charge. Complete all steps to finalize coverage.</p>
    </div>

    <div class="card step">
      <h2>Step 1 — Review your policy</h2>
      <p><strong>${input.policyName}</strong></p>
      <p>Monthly premium: <strong>PKR ${input.premiumMonthlyPkr}</strong></p>
      <p class="muted">Your questionnaire responses:</p>
      <ul>${input.answerSummaryHtml}</ul>
    </div>

    <div class="card step">
      <h2>Step 2 — Simulate payment</h2>
      <p class="muted">Enter card details as you would with ${input.insurerName}. Fields are validated but not charged.</p>
      <form id="payment-form" novalidate>
        <label>Cardholder name (as on card)
          <input name="cardholderName" required minlength="2" maxlength="120" autocomplete="cc-name" />
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
        <button type="submit" id="pay-btn" ${input.paymentProcessed ? 'disabled' : ''}>
          ${input.paymentProcessed ? 'Payment already processed' : 'Process payment securely'}
        </button>
      </form>
      <p id="payment-msg" class="${input.paymentProcessed ? 'success' : 'muted'}">
        ${input.paymentProcessed ? 'Payment processed. Continue to step 4.' : ''}
      </p>
    </div>

    <div class="card step">
      <h2>Step 3 — Visit insurer (optional)</h2>
      <p class="muted">Open ${input.insurerName}'s website in a new tab if you want to review official policy documents.</p>
      <a class="btn" href="${input.insurerExternalUrl}" target="_blank" rel="noopener noreferrer">Open ${input.insurerName} website</a>
    </div>

    <div class="card step">
      <h2>Step 4 — Complete on ClearClever</h2>
      <p class="muted">Finalize your purchase and return to your dashboard timeline.</p>
      <a class="btn" id="complete-btn" href="${completeUrl}">Complete on ClearClever</a>
      ${input.completed ? '<p class="success">This purchase is already completed.</p>' : ''}
      ${!input.paymentProcessed ? '<p class="muted" id="complete-hint">Complete step 2 before finishing.</p>' : ''}
    </div>
  </main>
  <script>
    const purchaseId = ${JSON.stringify(input.purchaseId)};
    const token = ${JSON.stringify(input.token)};
    const apiBase = ${JSON.stringify(input.apiPublicUrl)};
    const form = document.getElementById('payment-form');
    const payBtn = document.getElementById('pay-btn');
    const paymentMsg = document.getElementById('payment-msg');
    const completeBtn = document.getElementById('complete-btn');
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
          paymentMsg.textContent = 'Please process payment in step 2 before completing.';
          paymentMsg.className = 'error';
        }
      });
    }

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
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          showFieldErrors(json.errors || []);
          throw new Error(json.message || 'We could not process your payment details.');
        }
        paymentMsg.textContent = 'Payment processed successfully. You can now complete on ClearClever.';
        paymentMsg.className = 'success';
        payBtn.textContent = 'Payment already processed';
        paymentDone = true;
        const hint = document.getElementById('complete-hint');
        if (hint) hint.remove();
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
