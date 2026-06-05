import type { Env } from '../config/env';
import { isBrevoConfigured, isSmtpConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';
import { sendOtpViaBrevo, probeBrevo, sendTransactionalViaBrevo } from './brevo';
import {
  formatSmtpError,
  probeSmtp,
  sendOtpEmail,
  sendTransactionalEmail,
  type SmtpProbeResult,
} from './mail';
import { passwordResetTemplate, renderBrandedEmail } from './emailTemplates';

export const DEFAULT_SUPPORT_INBOX_EMAIL = 'syedzurainrizvi@gmail.com';

export function resolveSupportInboxEmail(): string {
  const fromEnv = process.env.SUPPORT_INBOX_EMAIL?.trim();
  return fromEnv || DEFAULT_SUPPORT_INBOX_EMAIL;
}

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

const PASSWORD_RESET_SUBJECT = 'Reset your ClearClever password';

/** Branded password reset link — Brevo on Render, SMTP locally. */
export async function sendPasswordResetEmailDelivery(
  env: Env,
  to: string,
  resetUrl: string
): Promise<void> {
  const branded = passwordResetTemplate(resetUrl);

  if (isBrevoConfigured(env)) {
    await sendTransactionalViaBrevo(env, to, PASSWORD_RESET_SUBJECT, branded.html, branded.text);
    return;
  }

  if (isSmtpConfigured(env)) {
    await sendTransactionalEmail(env, to, PASSWORD_RESET_SUBJECT, branded.html, branded.text);
  }
}

export async function sendSupportInquiryEmail(
  env: Env,
  input: {
    fullName: string;
    email: string;
    roleLabel: string;
    reason: string;
    message: string;
  }
): Promise<void> {
  const to = resolveSupportInboxEmail();
  const subject = `ClearClever support: ${input.reason.replace(/_/g, ' ')}`;
  const text = [
    'New support inquiry',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Role: ${input.roleLabel}`,
    `Reason: ${input.reason}`,
    '',
    input.message,
  ].join('\n');

  const branded = renderBrandedEmail({
    title: 'New support inquiry',
    preheader: 'Support ticket raised by a user',
    bodyHtml: `
      <p><strong>Name:</strong> ${input.fullName}</p>
      <p><strong>Email:</strong> ${input.email}</p>
      <p><strong>Role:</strong> ${input.roleLabel.replace(/_/g, ' ')}</p>
      <p><strong>Reason:</strong> ${input.reason.replace(/_/g, ' ')}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${input.message}</p>
    `,
    bodyText: text,
  });

  if (isBrevoConfigured(env)) {
    await sendTransactionalViaBrevo(env, to, subject, branded.html, branded.text);
    return;
  }

  if (isSmtpConfigured(env)) {
    await sendTransactionalEmail(env, to, subject, branded.html, branded.text);
  }
}
