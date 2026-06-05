# ClearClever — Deployment (Module 3)

Public API on **Render** + database on **MongoDB Atlas M0**. Frontend on Vercel comes in Module 10.

## 1. MongoDB Atlas (M0)

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → create free **M0** cluster (region: **Mumbai** or **Singapore** for Pakistan latency).
2. **Database Access** → add a DB user (username + strong password).
3. **Network Access** → for development, add `0.0.0.0/0` (allow from anywhere). Tighten later if needed.
4. **Connect** → Drivers → copy connection string, e.g.  
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/clearclever?retryWrites=true&w=majority`
5. Put it in local `.env` as `MONGODB_URI` and in Render as an environment variable.

### Seed users and demo data (Atlas)

From `clear-clever-backend` with `MONGODB_URI` pointing at Atlas:

```bash
npm run seed
```

Re-running is safe (users/catalog upsert by email/slug; demo transactions wipe and recreate for seed accounts only). Signup users created after deploy are **never** touched.

**Password (all accounts):** `password`  
Override locally with `SEED_PASSWORD=your-secret npm run seed` if needed.

| Email | Role | Notes |
|-------|------|--------|
| `seeker@clearclever.com` | user | Primary policy seeker demo (purchases, claims, messages) |
| `syedzurainrizvi@gmail.com` | user | Secondary seeker demo |
| `insurer.tpl@clearclever.com` | insurer | TPL Insurance |
| `insurer.jubilee@clearclever.com` | insurer | Jubilee General Insurance |
| `insurer.adamjee@clearclever.com` | insurer | Adamjee Insurance |
| `insurer.hbl@clearclever.com` | insurer | HBL Insurance |
| `insurer.allianz@clearclever.com` | insurer | Allianz |
| `insurer.efu@clearclever.com` | insurer | EFU Life |
| `insurer.igi@clearclever.com` | insurer | IGI General |
| `insurer.pending@clearclever.com` | insurer | Pending verification (superadmin approvals demo) |
| `admin@clearclever.com` | admin | Employee admin portal |
| `superadmin@clearclever.com` | superadmin | Super Admin portal |

### Demo walkthrough (evaluators)

1. **Policy seeker** — `seeker@clearclever.com` → Compare Policies → Saved → My Purchases (timeline) → Claims → Messages
2. **Insurer** — `insurer.tpl@clearclever.com` → Dashboard → Leads & Customers → Analytics → Claims
3. **Employee admin** — `admin@clearclever.com` → Approvals (4 pending policies) → Providers (7 active) → Reports
4. **Super Admin** — `superadmin@clearclever.com` → Provider approvals (pending insurer) → Fraud → Platform analytics → System health
5. **Affiliate checkout** — complete a purchase flow; redirect lands on `/affiliate/{insurer-slug}?purchaseId=...`

---

## 2. Render (API)

### Option A — Blueprint (`render.yaml`)

1. Push `clear-clever-backend` to GitHub.
2. Render → **New** → **Blueprint** → connect repo (use repo root if the backend is the whole repo).
3. Set secret env vars when prompted: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, Gmail SMTP (`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).

### Option B — Web Service (manual)

| Setting | Value |
|---------|--------|
| Runtime | Node **22** (repo has `.node-version`; optional env `NODE_VERSION=22`) |
| Build Command | **`npm ci --include=dev && npm run build:render`** |
| Start Command | `npm start` |
| Health check path | `/api/health` |

**Do not use** `npm install; npm run build` — it skips devDependencies and breaks TypeScript (TS5107).

**Do not** add `NODE_ENV=production` as a manual env var on Render. It makes installs skip devDependencies during build. Render sets production at runtime automatically.

### Required environment variables

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render sets this automatically; blueprint default is fine) |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Random string, **≥ 32 characters** |
| `CORS_ORIGINS` | `http://localhost:5173` and your Vercel URL when ready, comma-separated |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail **App Password** (16 chars) |
| `SMTP_FROM` | `ClearClever <your.gmail@gmail.com>` |
| `API_PUBLIC_URL` | **`https://clear-clever-backend.onrender.com`** (your Render service URL, **with `https://`**) — used for affiliate purchase redirects |
| `CLIENT_URL` | **`https://clearclever.vercel.app`** (Vercel production URL, **with `https://`**) — post-purchase redirect, email CTAs, and hosted `/brand/*` logos |

Do **not** set `OTP_DEBUG=true` on Render.

### Gemini AI assistant (optional)

The floating **AI Assistant** calls Google’s API from the backend only. Set on **Render** (never in Vercel or the frontend bundle):

| Variable | Value |
|----------|--------|
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/) — create a key, store only on Render |
| `GEMINI_MODEL` | `gemini-2.5-flash` (default if omitted) |
| `GEMINI_MAX_OUTPUT_TOKENS` | `1024` (optional) |
| `GEMINI_UPSTREAM_RPM` | `18` — process-wide cap on `generateContent` calls/min (stay under Google free tier ~20 RPM) |
| `ASSISTANT_RATE_LIMIT_PER_MIN` | `15` — per-user/IP cap on assistant routes (optional) |

If `GEMINI_API_KEY` is unset, `GET /api/assistant/status` returns `configured: false` and the widget stays hidden. Rotate keys if one is ever exposed in chat or screenshots. On the **free tier**, `gemini-2.5-flash` is limited to about **20 `generateContent` requests per minute** — the API does not retry 429s (retries burn quota). Monitor usage in [Google AI Studio](https://aistudio.google.com/).

**Module 7:** If `API_PUBLIC_URL` is missing, purchase `redirectUrl` will incorrectly point to `http://localhost:5000` and affiliate checkout will break. Host-only values like `clear-clever-backend.onrender.com` are auto-prefixed with `https://` on startup.

### OTP email on Render (important)

**Render free web services block outbound SMTP** (ports 25, 465, 587). Gmail SMTP works on your laptop but **times out on Render free tier** — this is a platform rule, not a bug in your app password.

Choose one:

| Option | Cost | Setup |
|--------|------|--------|
| **A. Brevo (recommended)** | Free (~300 emails/day) | HTTPS API — works on Render free |
| **B. Upgrade Render** | Paid instance | Keep Gmail `SMTP_*` vars |
| **C. Local dev only** | — | `OTP_DEBUG=true` (never on Render) |

#### Option A — Brevo (free, works on Render free)

1. Sign up at [brevo.com](https://www.brevo.com).
2. **Senders** → verify your personal Gmail (the address users will see as “from”).
3. **SMTP & API** → **API Keys** → create a key.
4. On Render, add:

| Variable | Value |
|----------|--------|
| `BREVO_API_KEY` | your `xkeysib-...` key |
| `BREVO_SENDER_EMAIL` | same Gmail you verified in Brevo |
| `BREVO_SENDER_NAME` | `ClearClever` |

5. **Manual Deploy**. Check `GET /api/health` → `data.email.provider` should be `"brevo"` and `ready: true`.

You can keep `SMTP_*` for local development; production uses Brevo when `BREVO_API_KEY` is set.

#### Option B — Gmail SMTP (paid Render only)

1. Google Account → **Security** → enable **2-Step Verification**.
2. **App passwords** → Mail → generate 16-character password.
3. Use that value for `SMTP_PASS` on a **paid** Render web service.

### After first deploy

1. Run seed against Atlas (from your machine): `npm run seed`
2. Smoke test:

```bash
API_URL=https://clear-clever-backend.onrender.com npm run smoke:prod
```

Optional: `SMOKE_EMAIL=seeker@clearclever.com SMOKE_PASSWORD=password`

3. Open `https://<your-service>.onrender.com/api/health` on your phone (should return JSON `200`).

### Login check (curl)

```bash
curl -s -X POST https://<your-service>.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clearclever.com","password":"password"}'
```

Expect `"success":true` and a `token` in `data`.

---

## 3. CORS

`CORS_ORIGINS` must include every browser origin that calls the API:

- Local: `http://localhost:5173`
- Production SPA (later): `https://your-app.vercel.app`

Comma-separated, no trailing slashes.

---

## 4. Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails `TS5107` / `moduleResolution` | Pull latest `main` (Node 22 + pinned TypeScript); use `npm ci && npm run build` |
| Build fails `tsc: not found` / missing `@types/node` | Use build command `npm ci --include=dev && npm run build`; remove manual `NODE_ENV` from Render env |
| Health 503 / DB `disconnected` | Check `MONGODB_URI`, Atlas IP allowlist, URL-encode `!` in password |
| Login 403 “verify email” | Re-run `npm run seed` so status is `active` |
| OTP signup fails on Render | Configure SMTP; never use `OTP_DEBUG` in production |
| Signup/sign-in stuck on “Creating…” / “Signing in…” | Usually SMTP blocking the API for ~2 min. Deploy latest backend (fast signup + 10s SMTP cap). Check Render logs for `OTP email not delivered` |
| OTP never arrives (`emailSent: false`) | On **Render free**: use **Brevo** (`BREVO_API_KEY`), not Gmail SMTP. For paid Render + Gmail: App Password in `SMTP_PASS`, `SMTP_FROM` = `ClearClever <same@gmail.as.SMTP_USER>` |
| `/api/health` → `email.ready: false`, SMTP timeout | Render free blocks SMTP — add `BREVO_API_KEY` or upgrade Render |
| CORS error in browser | Add frontend URL to `CORS_ORIGINS`, redeploy API |
| Deploy fails on start / “Invalid environment” | `CLIENT_URL` / `API_PUBLIC_URL` must be valid URLs — use `https://...` or host-only (`your-app.vercel.app`); avoid bare `localhost` on Render |
| Purchase redirect goes to localhost | Set `API_PUBLIC_URL` on Render to your service URL, **Save**, then **Manual Deploy** |
| Render cold start | Free tier sleeps; first request may take ~30s |
| Request hangs / times out (0 bytes, HTTP 000) | App stuck before `listen` — usually **MongoDB**. Check Render **Logs** for `[ClearClever] Failed to start server`. Fix `MONGODB_URI` (include `/clearclever` db name), URL-encode special chars in password (`!` → `%21`), Atlas **Network Access** `0.0.0.0/0`, then **Manual Deploy** |
| Wrong hostname (`x-render-routing: no-server`) | Use the exact URL from Render dashboard (e.g. `https://clear-clever-backend.onrender.com`), not a guessed name |

---

## 5. What you do locally

```bash
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET
npm install
npm run dev
npm run seed    # once Atlas URI is in .env
npm test
```
