import nodemailer from 'nodemailer';
import type { Env } from '../config/env';
import { isSmtpConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';

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

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: env.SMTP_FROM ?? 'ClearClever <noreply@clearclever.com>',
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>ClearClever</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p style="color: #666;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
    text: `Your ClearClever verification code is ${code}. It expires in 10 minutes.`,
  });
}
