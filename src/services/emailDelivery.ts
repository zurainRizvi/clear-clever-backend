import type { Env } from '../config/env';
import { isBrevoConfigured, isSmtpConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';
import { sendOtpViaBrevo, probeBrevo } from './brevo';
import { formatSmtpError, probeSmtp, sendOtpEmail, type SmtpProbeResult } from './mail';

export type EmailProvider = 'brevo' | 'smtp' | 'none';

export function getEmailProvider(env: Env): EmailProvider {
  if (isBrevoConfigured(env)) return 'brevo';
  if (isSmtpConfigured(env)) return 'smtp';
  return 'none';
}

export function isOutboundEmailConfigured(env: Env): boolean {
  return getEmailProvider(env) !== 'none';
}

export async function probeOutboundEmail(env: Env): Promise<SmtpProbeResult & { provider: EmailProvider }> {
  const provider = getEmailProvider(env);
  if (provider === 'brevo') {
    const result = await probeBrevo(env);
    return { ...result, provider };
  }
  if (provider === 'smtp') {
    const result = await probeSmtp(env);
    return { ...result, provider };
  }
  return { ok: false, error: 'No email provider configured', provider: 'none' };
}

/** Prefer Brevo on Render (HTTPS); SMTP for local Gmail. */
export async function sendOtpEmailDelivery(
  env: Env,
  to: string,
  code: string,
  purpose: OtpPurpose
): Promise<void> {
  if (isBrevoConfigured(env)) {
    await sendOtpViaBrevo(env, to, code, purpose);
    return;
  }

  if (isSmtpConfigured(env)) {
    await sendOtpEmail(env, to, code, purpose);
    return;
  }
}

export function formatEmailError(error: unknown): string {
  return formatSmtpError(error);
}
