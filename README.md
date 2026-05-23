# ClearClever — Backend

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
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled `dist/` |
| `npm run seed` | Upsert demo users into Atlas (see DEPLOYMENT.md) |
| `npm run smoke:prod` | Health + login check against deployed API (`API_URL=...`) |
| `npm test` | Jest tests |

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
