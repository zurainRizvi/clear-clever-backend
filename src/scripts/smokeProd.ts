/**
 * Production smoke test — health + seeded login.
 * Usage: API_URL=https://your-app.onrender.com npm run smoke:prod
 */
const API_URL = (process.env.API_URL ?? process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '');
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'admin@clearclever.com';
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'password';

async function requestJson(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

async function main(): Promise<void> {
  if (!API_URL) {
    console.error('[smoke:prod] Set API_URL (or API_PUBLIC_URL) to your Render base URL.');
    process.exit(1);
  }

  console.log(`[smoke:prod] Target: ${API_URL}`);

  const health = await requestJson('GET', '/api/health');
  if (health.status !== 200) {
    console.error('[smoke:prod] Health check failed:', health.status, health.body);
    process.exit(1);
  }
  console.log('[smoke:prod] Health OK');

  const login = await requestJson('POST', '/api/auth/login', {
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });
  const data = login.body.data as Record<string, unknown> | undefined;
  const token = data?.token;

  if (login.status !== 200 || typeof token !== 'string') {
    console.error('[smoke:prod] Login failed:', login.status, login.body);
    process.exit(1);
  }
  console.log(`[smoke:prod] Login OK (${SMOKE_EMAIL})`);

  const meRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (meRes.status !== 200) {
    console.error('[smoke:prod] /api/auth/me failed:', meRes.status);
    process.exit(1);
  }
  console.log('[smoke:prod] Auth me OK');

  const seekerLogin = await requestJson('POST', '/api/auth/login', {
    email: process.env.SMOKE_SEEKER_EMAIL ?? 'seeker@clearclever.com',
    password: SMOKE_PASSWORD,
  });
  const seekerToken = (seekerLogin.body.data as Record<string, unknown> | undefined)?.token;
  if (seekerLogin.status !== 200 || typeof seekerToken !== 'string') {
    console.error('[smoke:prod] Seeker login failed:', seekerLogin.status, seekerLogin.body);
    process.exit(1);
  }

  const recommendRes = await fetch(`${API_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      category: 'home',
      answers: { property_type: 'Apartment', property_value_pkr: 5000000 },
    }),
  });
  const recommendBody = (await recommendRes.json()) as {
    data?: { recommendations?: { policy: { id: string } }[] };
  };
  const policyId = recommendBody.data?.recommendations?.[0]?.policy?.id;
  if (!policyId) {
    console.error('[smoke:prod] No approved home policy for purchase smoke');
    process.exit(1);
  }

  const purchaseRes = await fetch(`${API_URL}/api/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${seekerToken}`,
    },
    body: JSON.stringify({ policyId, answers: { property_type: 'Apartment' } }),
  });
  const purchaseBody = (await purchaseRes.json()) as {
    success?: boolean;
    data?: { redirectUrl?: string; purchaseId?: string };
  };
  const redirectUrl = purchaseBody.data?.redirectUrl ?? '';
  if (purchaseRes.status !== 201 || !redirectUrl) {
    console.error('[smoke:prod] Purchase create failed:', purchaseRes.status, purchaseBody);
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1/.test(redirectUrl)) {
    console.error(
      '[smoke:prod] redirectUrl still points to localhost — set API_PUBLIC_URL on Render to your service URL (include https://).'
    );
    console.error(`  Got: ${redirectUrl}`);
    process.exit(1);
  }
  if (!redirectUrl.includes('/affiliate/')) {
    console.error('[smoke:prod] redirectUrl missing /affiliate/ path:', redirectUrl);
    process.exit(1);
  }
  console.log('[smoke:prod] Purchase redirect URL OK');

  console.log('[smoke:prod] All checks passed');
}

main().catch((err) => {
  console.error('[smoke:prod] Error:', err);
  process.exit(1);
});
