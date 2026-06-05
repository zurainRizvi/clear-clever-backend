import type { Env } from '../config/env';
import { isBrevoConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';
import { formatSmtpError, type SmtpProbeResult } from './mail';
import { otpTemplate } from './emailTemplates';

const BREVO_API = 'https://api.brevo.com/v3';

export function resolveBrevoSender(env: Env): { name: string; email: string } {
  if (env.BREVO_SENDER_EMAIL) {
    return {
      name: env.BREVO_SENDER_NAME ?? 'ClearClever',
      email: env.BREVO_SENDER_EMAIL,
    };
  }

  const from = env.SMTP_FROM ?? env.SMTP_USER;
  if (!from) {
    throw new Error('Set BREVO_SENDER_EMAIL or SMTP_USER for the sender address');
  }

  const bracket = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (bracket) {
    return { name: bracket[1].trim().replace(/^["']|["']$/g, ''), email: bracket[2].trim() };
  }

  return { name: 'ClearClever', email: from };
}

export async function probeBrevo(env: Env): Promise<SmtpProbeResult> {
  if (!isBrevoConfigured(env)) {
    return { ok: false, error: 'BREVO_API_KEY is required' };
  }

  try {
    const res = await fetch(`${BREVO_API}/account`, {
      headers: { 'api-key': env.BREVO_API_KEY! },
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Brevo account check failed (${res.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatSmtpError(error) };
  }
}

export async function sendOtpViaBrevo(
  env: Env,
  to: string,
  code: string,
  purpose: OtpPurpose
): Promise<void> {
  if (!isBrevoConfigured(env)) {
    return;
  }

  const sender = resolveBrevoSender(env);
  const subject =
    purpose === 'signup'
      ? 'Verify your ClearClever account'
      : 'ClearClever password reset code';

  const otpEmail = otpTemplate(code);

  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY!,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: otpEmail.html,
      textContent: otpEmail.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

export async function sendTransactionalViaBrevo(
  env: Env,
  to: string,
  subject: string,
  html: string,
  textContent: string,
  options?: { replyTo?: string }
): Promise<void> {
  if (!isBrevoConfigured(env)) {
    return;
  }

  const sender = resolveBrevoSender(env);
  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY!,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      ...(options?.replyTo ? { replyTo: { email: options.replyTo } } : {}),
      subject,
      htmlContent: html,
      textContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
