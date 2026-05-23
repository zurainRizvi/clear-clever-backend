# ClearClever — Deployment (Module 3)

Public API on **Render** + database on **MongoDB Atlas M0**. Frontend on Vercel comes in Module 10.

## 1. MongoDB Atlas (M0)

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → create free **M0** cluster (region: **Mumbai** or **Singapore** for Pakistan latency).
2. **Database Access** → add a DB user (username + strong password).
3. **Network Access** → for development, add `0.0.0.0/0` (allow from anywhere). Tighten later if needed.
4. **Connect** → Drivers → copy connection string, e.g.  
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/clearclever?retryWrites=true&w=majority`
5. Put it in local `.env` as `MONGODB_URI` and in Render as an environment variable.

### Seed users (Atlas)

From `clear-clever-backend` with `MONGODB_URI` pointing at Atlas:

```bash
npm run seed
```

Re-running is safe (upsert by email). All seeded accounts are **already verified** (`status: active`).

| Email | Role | Notes |
|-------|------|--------|
| `syedzurainrizvi@gmail.com` | user | Policy seeker (Lahore) |
| `seeker@clearclever.com` | user | Second seeker (Lahore) |
| `insurer.tpl@clearclever.com` | insurer | TPL — Lahore |
| `insurer.jubilee@clearclever.com` | insurer | Jubilee — Lahore |
| `insurer.adamjee@clearclever.com` | insurer | Adamjee — Lahore |
| `admin@clearclever.com` | admin | Platform admin |
| `superadmin@clearclever.com` | superadmin | Full admin |

**Password (all accounts):** `password`  
Override locally with `SEED_PASSWORD=your-secret npm run seed` if needed.

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
| Build | `npm ci && npm run build` |
| Start | `npm start` |
| Health check path | `/api/health` |

**Important:** Do **not** add `NODE_ENV=production` as a manual env var on Render. It makes `npm ci` skip devDependencies during build (no `tsc`). Render sets production at runtime automatically.

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

Do **not** set `OTP_DEBUG=true` on Render.

### Gmail App Password (OTP)

1. Google Account → **Security** → enable **2-Step Verification**.
2. **App passwords** → Mail → generate 16-character password.
3. Use that value for `SMTP_PASS` on Render.

### After first deploy

1. Run seed against Atlas (from your machine): `npm run seed`
2. Smoke test:

```bash
API_URL=https://<your-service>.onrender.com npm run smoke:prod
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
| Build fails `tsc: not found` | Remove manual `NODE_ENV=production` from Render env; redeploy |
| Health 503 / DB `disconnected` | Check `MONGODB_URI`, Atlas IP allowlist, URL-encode `!` in password |
| Login 403 “verify email” | Re-run `npm run seed` so status is `active` |
| OTP signup fails on Render | Configure SMTP; never use `OTP_DEBUG` in production |
| CORS error in browser | Add frontend URL to `CORS_ORIGINS`, redeploy API |
| Render cold start | Free tier sleeps; first request may take ~30s |

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
