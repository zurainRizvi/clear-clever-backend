import { z } from 'zod';

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
      const raw = value?.trim() || 'http://localhost:5173';
      return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  CLIENT_URL: z
    .string()
    .url('CLIENT_URL must be a valid URL')
    .default('http://localhost:5173'),
  API_PUBLIC_URL: z
    .string()
    .url('API_PUBLIC_URL must be a valid URL')
    .default('http://localhost:5000'),
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
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function isSmtpConfigured(env: Env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}
