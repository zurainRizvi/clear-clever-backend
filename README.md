# ClearClever — Backend

Express + TypeScript + MongoDB API for ClearClever (FYP). Module 1: health, env validation, CORS, error handling.

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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled `dist/` |
| `npm test` | Jest tests |

## Repository

https://github.com/zurainRizvi/clear-clever-backend
