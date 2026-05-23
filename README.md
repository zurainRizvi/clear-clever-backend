# ClearClever — Backend

[![CI](https://github.com/zurainRizvi/clear-clever-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/zurainRizvi/clear-clever-backend/actions/workflows/ci.yml)

Express + TypeScript + MongoDB API for ClearClever (FYP).

**Module 1:** health, env validation, CORS, error handling.  
**Module 2:** signup, login, OTP verify/resend, JWT, `/api/auth/me`, role selection.  
**Module 3:** Atlas user seed, Render deploy config, production smoke script — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Health: http://localhost:5000/api/health

**Production (Render):** https://clear-clever-backend.onrender.com/api/health

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` \| `production` \| `test` (default: development) |
| `PORT` | No | API port (default: 5000) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `CORS_ORIGINS` | No | Comma-separated frontend URLs (default: `http://localhost:5173`) |
| `JWT_SECRET` | Yes | Min 32 characters |
| `JWT_EXPIRES_IN` | No | Token lifetime (default: `7d`) |
| `OTP_DEBUG` | No | `true` = return OTP in API when SMTP not set (dev only) |
| `SMTP_*` | No | Gmail SMTP for real OTP emails |

## Auth API (Module 2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register (`fullName`, `email`, `phone`, `password`) |
| POST | `/api/auth/otp/send` | Resend OTP (`email`, `purpose`: `signup` \| `reset`) |
| POST | `/api/auth/otp/verify` | Verify OTP → JWT |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Profile (Bearer token) |
| PATCH | `/api/auth/role` | Set role `user` \| `insurer` (after OTP) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript (runs prebuild toolchain check) |
| `npm run build:render` | Same as build — **use this command on Render** |
| `npm run start` | Run compiled `dist/` |
| `npm run typecheck` | `tsc --noEmit` (used by CI) |
| `npm run seed` | Upsert demo users into Atlas (see DEPLOYMENT.md) |
| `npm run smoke:prod` | Health + login check against deployed API (`API_URL=...`) |
| `npm test` | Jest tests (local) |
| `npm run test:ci` | Jest in CI mode (`--ci --runInBand --forceExit`) |

## CI / CD

GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

| Trigger | Job | Steps |
|---------|-----|-------|
| `push` / `pull_request` to `main` | `test` | `npm ci` → `typecheck` → `build` → `test:ci` (Jest + supertest + mongodb-memory-server, with binary cache) |
| `push` to `main` after `test` passes | `deploy-trigger` | Render auto-deploys via the Git integration; if you set `RENDER_DEPLOY_HOOK` as a repo secret, the workflow will also POST it explicitly |

Render deploy is gated by the `test` job — failing tests will not deploy because Render only redeploys on green commits to `main` (you also have `render.yaml` for blueprint deploys).

### Optional: explicit Render deploy hook

1. Render dashboard → your service → **Settings** → **Deploy Hook** → copy URL.
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name `RENDER_DEPLOY_HOOK`, value = the URL.

## Demo accounts (after `npm run seed`)

| Email | Role |
|-------|------|
| `syedzurainrizvi@gmail.com` | user |
| `seeker@clearclever.com` | user |
| `insurer.tpl@clearclever.com` | insurer |
| `insurer.jubilee@clearclever.com` | insurer |
| `insurer.adamjee@clearclever.com` | insurer |
| `admin@clearclever.com` | admin |
| `superadmin@clearclever.com` | superadmin |

Password for all: `password` (change in production after FYP demo).

## Repository

https://github.com/zurainRizvi/clear-clever-backend
