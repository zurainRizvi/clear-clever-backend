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

export function renderAffiliatePage(input: AffiliatePageInput): string {
  const completeUrl = `${input.apiPublicUrl}/api/purchase/complete?purchaseId=${encodeURIComponent(input.purchaseId)}&token=${encodeURIComponent(input.token)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.insurerName} — ClearClever Affiliate</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f4f7fb; color: #0f172a; }
    main { max-width: 720px; margin: 2rem auto; padding: 0 1rem 3rem; }
    .card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 8px 24px rgba(15,23,42,.08); margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
    .step { border-left: 4px solid #2563eb; padding-left: 1rem; margin: 1.25rem 0; }
    label { display: block; margin-top: .75rem; font-weight: 600; font-size: .9rem; }
    input { width: 100%; padding: .6rem .75rem; margin-top: .25rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; }
    button, .btn { display: inline-block; margin-top: 1rem; background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: .7rem 1rem; font-weight: 600; cursor: pointer; text-decoration: none; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .muted { color: #64748b; font-size: .9rem; }
    .success { color: #15803d; font-weight: 600; }
    .error { color: #b91c1c; font-weight: 600; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>${input.insurerName}</h1>
      <p class="muted">ClearClever affiliate partnership — simulated payment (no real charge)</p>
    </div>

    <div class="card step" id="step-review">
      <h2>Step 1 — Review policy</h2>
      <p><strong>${input.policyName}</strong></p>
      <p>Monthly premium: <strong>PKR ${input.premiumMonthlyPkr}</strong></p>
      <ul>${input.answerSummaryHtml}</ul>
    </div>

    <div class="card step" id="step-payment">
      <h2>Step 2 — Simulate payment</h2>
      <form id="payment-form">
        <label>Cardholder name<input name="cardholderName" required minlength="2" /></label>
        <label>Last 4 digits<input name="cardLast4" required pattern="\\d{4}" maxlength="4" /></label>
        <label>Expiry (MM/YY)<input name="cardExpiry" required pattern="(0[1-9]|1[0-2])/\\d{2}" placeholder="12/28" /></label>
        <button type="submit" id="pay-btn" ${input.paymentProcessed ? 'disabled' : ''}>
          ${input.paymentProcessed ? 'Payment already processed' : 'Process Payment'}
        </button>
      </form>
      <p id="payment-msg" class="${input.paymentProcessed ? 'success' : ''}">
        ${input.paymentProcessed ? 'Payment processed. Proceed to step 3.' : ''}
      </p>
    </div>

    <div class="card step" id="step-insurer">
      <h2>Step 3 — Proceed to insurer</h2>
      <p class="muted">Optional: visit the insurer website in a new tab.</p>
      <a class="btn" href="${input.insurerExternalUrl}" target="_blank" rel="noopener noreferrer">Open insurer site</a>
    </div>

    <div class="card step" id="step-complete">
      <h2>Step 4 — Complete on ClearClever</h2>
      <p class="muted">Finalize your purchase and return to the app.</p>
      <a class="btn" id="complete-btn" href="${completeUrl}">Complete on ClearClever</a>
      ${input.completed ? '<p class="success">This purchase is already completed.</p>' : ''}
    </div>
  </main>
  <script>
    const purchaseId = ${JSON.stringify(input.purchaseId)};
    const token = ${JSON.stringify(input.token)};
    const apiBase = ${JSON.stringify(input.apiPublicUrl)};
    const form = document.getElementById('payment-form');
    const payBtn = document.getElementById('pay-btn');
    const paymentMsg = document.getElementById('payment-msg');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      payBtn.disabled = true;
      paymentMsg.textContent = 'Processing...';
      paymentMsg.className = 'muted';

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
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Payment failed');
        paymentMsg.textContent = 'Payment processed successfully.';
        paymentMsg.className = 'success';
        payBtn.textContent = 'Payment already processed';
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
