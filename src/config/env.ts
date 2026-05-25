import { z } from 'zod';

/** Trim and strip accidental wrapping quotes from dashboard copy-paste. */
export function stripEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]+|['"]+$/g, '');
}

/** Accepts `https://app.vercel.app` or `app.vercel.app` (adds https). */
export function normalizePublicUrl(value: string | undefined, fallback: string): string {
  const raw = (value?.trim() || fallback).trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
}

const urlFromEnv = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => normalizePublicUrl(value, fallback))
    .pipe(z.string().url());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  OTP_DEBUG: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) => {
      const raw =
        value?.trim() ||
        'http://localhost:5173,http://localhost:5174,http://localhost:5175';
      return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }),
  SMTP_HOST: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  SMTP_PASS: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  SMTP_FROM: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  /** Brevo (HTTPS) — required for OTP on Render free tier (SMTP ports blocked). */
  BREVO_API_KEY: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  BREVO_SENDER_EMAIL: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  BREVO_SENDER_NAME: z
    .string()
    .optional()
    .transform((v) => stripEnvValue(v)),
  CLIENT_URL: urlFromEnv('http://localhost:5173'),
  API_PUBLIC_URL: urlFromEnv('http://localhost:5000'),
});

export type Env = z.infer<typeof envSchema> & {
  CORS_ORIGINS: string[];
  OTP_DEBUG: boolean;
  SMTP_SECURE: boolean;
};

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.') || 'env';
      return `${path}: ${issue.message}`;
    });
    console.error('\n[ClearClever] Invalid environment configuration:\n');
    messages.forEach((msg) => console.error(`  - ${msg}`));
    console.error('\nCopy .env.example to .env and set the required values.\n');
    process.exit(1);
  }

  cached = parsed.data as Env;

  if (cached.NODE_ENV === 'production') {
    const smtpOnly =
      Boolean(cached.SMTP_HOST && cached.SMTP_USER && cached.SMTP_PASS) && !cached.BREVO_API_KEY;
    if (smtpOnly) {
      console.warn(
        '[ClearClever] WARNING: Render free tier blocks Gmail SMTP (ports 587/465). Add BREVO_API_KEY or upgrade to a paid Render instance — see docs/DEPLOYMENT.md'
      );
    }
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
    if (localhostPattern.test(cached.API_PUBLIC_URL)) {
      console.warn(
        '[ClearClever] WARNING: API_PUBLIC_URL is still localhost in production. Set it to your Render URL (e.g. https://clear-clever-backend.onrender.com).'
      );
    }
    if (localhostPattern.test(cached.CLIENT_URL)) {
      console.warn(
        '[ClearClever] WARNING: CLIENT_URL is still localhost in production. Set it to your Vercel URL (e.g. https://your-app.vercel.app).'
      );
    }
  }

  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function isSmtpConfigured(env: Env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export function isBrevoConfigured(env: Env): boolean {
  return Boolean(env.BREVO_API_KEY);
}
