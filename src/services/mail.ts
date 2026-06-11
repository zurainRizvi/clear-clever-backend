import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Env } from '../config/env';
import { isSmtpConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';
import { otpTemplate } from './emailTemplates';

/** Cap SMTP connect/send so auth routes never block for minutes. */
export const SMTP_TIMEOUT_MS = 15_000;

export type SmtpProbeResult =
  | { ok: true; latencyMs?: number }
  | { ok: false; error: string; latencyMs?: number };

function isGmailHost(host: string | undefined): boolean {
  return (host ?? '').toLowerCase().includes('gmail.com');
}

export function createSmtpTransport(env: Env): Transporter {
  const auth = {
    user: env.SMTP_USER!,
    pass: env.SMTP_PASS!,
  };

  if (isGmailHost(env.SMTP_HOST)) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth,
    });
  }

  const port = env.SMTP_PORT ?? 587;
  const secure = env.SMTP_SECURE ?? port === 465;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    auth,
    requireTLS: !secure && port === 587,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${SMTP_TIMEOUT_MS}ms`)),
          SMTP_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function formatSmtpError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const extra = error as Error & { code?: string; response?: string };
  const parts = [extra.message];
  if (extra.code) parts.push(`code=${extra.code}`);
  if (extra.response) parts.push(String(extra.response).slice(0, 200));
  return parts.join(' | ');
}

/** Call once at startup (and from test script) to validate Render Gmail credentials. */
export async function probeSmtp(env: Env): Promise<SmtpProbeResult> {
  if (!isSmtpConfigured(env)) {
    return { ok: false, error: 'SMTP_HOST, SMTP_USER, and SMTP_PASS are required' };
  }

  const start = Date.now();
  const transport = createSmtpTransport(env);
  try {
    await withTimeout(transport.verify(), 'SMTP verify');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, error: formatSmtpError(error) };
  } finally {
    transport.close();
  }
}

export async function sendOtpEmail(
  env: Env,
  to: string,
  code: string,
  purpose: OtpPurpose
): Promise<void> {
  if (!isSmtpConfigured(env)) {
    return;
  }

  const subject =
    purpose === 'signup'
      ? 'Verify your ClearClever account'
      : 'ClearClever password reset code';

  const transport = createSmtpTransport(env);

  const otpEmail = otpTemplate(code);
  try {
    await withTimeout(
      transport.sendMail({
        from: env.SMTP_FROM ?? `ClearClever <${env.SMTP_USER}>`,
        to,
        subject,
        html: otpEmail.html,
        text: otpEmail.text,
      }),
      'SMTP send'
    );
  } finally {
    transport.close();
  }
}

export async function sendTransactionalEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  text: string,
  options?: { replyTo?: string }
): Promise<void> {
  if (!isSmtpConfigured(env)) {
    return;
  }

  const transport = createSmtpTransport(env);

  try {
    await withTimeout(
      transport.sendMail({
        from: env.SMTP_FROM ?? `ClearClever <${env.SMTP_USER}>`,
        to,
        replyTo: options?.replyTo,
        subject,
        html,
        text,
      }),
      'SMTP send'
    );
  } finally {
    transport.close();
  }
}
