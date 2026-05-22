import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
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
});

export type Env = z.infer<typeof envSchema> & { CORS_ORIGINS: string[] };

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
    console.error('\nCopy server/.env.example to server/.env and set the required values.\n');
    process.exit(1);
  }

  cached = parsed.data as Env;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
