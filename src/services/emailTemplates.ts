import { renderClearCleverEmail } from './clearCleverEmailLayout';
import { clientAppUrls } from './clientUrls';
import { resolveClientBaseUrl } from './clientUrls';
import { resolveEmailLogoUrl } from './emailAssets';

/** Compact branded layout for OTP and short transactional messages. */
export function renderBrandedEmail({
  title,
  preheader,
  bodyHtml,
  bodyText,
}: {
  title: string;
  preheader: string;
  bodyHtml: string;
  bodyText: string;
}): { html: string; text: string } {
  const base = resolveClientBaseUrl();
  const app = clientAppUrls(base);

  const result = renderClearCleverEmail(
    {
      preheader,
      headerLabel: 'Account security',
      badge: 'Secure message',
      heading: title,
      highlightWord: title.split(' ').slice(-1)[0] ?? title,
      highlightColor: '#4DA3FF',
      paragraph: 'Please review the details below. This message was sent from your ClearClever account.',
      heroGradient: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #2563EB 100%)',
      heroShadow: '0 20px 50px rgba(37, 99, 235, 0.25)',
      heroImageUrl:
        'https://images.unsplash.com/photo-1633265486064-086b219458ec?auto=format&fit=crop&w=640&q=80',
      heroImageAlt: 'Secure ClearClever account',
      primaryCta: { label: 'Open ClearClever', href: app.dashboard },
      detailHtml: bodyHtml,
      features: [
        {
          emoji: '🔐',
          title: 'Secure verification',
          description: 'Codes expire in 10 minutes',
          iconBackground: '#EEF4FF',
        },
        {
          emoji: '🛡️',
          title: 'Protected account',
          description: 'Never share your code',
          iconBackground: '#ECFDF3',
        },
        {
          emoji: '📱',
          title: 'In-app alerts',
          description: 'Stay updated in real time',
          iconBackground: '#F5F3FF',
        },
        {
          emoji: '✉️',
          title: 'Official sender',
          description: 'Only trust ClearClever emails',
          iconBackground: '#FFF4EC',
        },
      ],
      footerSupport: 'Did not request this? Contact support immediately.',
    },
    {
      clientBaseUrl: base,
      supportUrl: app.contactSupport,
      logoUrl: resolveEmailLogoUrl(base),
    }
  );

  return {
    html: result.html,
    text: [result.text, '', bodyText].join('\n'),
  };
}

export function otpTemplate(code: string): { html: string; text: string } {
  return renderBrandedEmail({
    title: 'Your verification code',
    preheader: 'Secure sign-in verification',
    bodyHtml: `<p style="margin:0 0 12px;">Your verification code is:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:8px 0 16px;color:#2563EB;">${code}</p>
      <p style="margin:0;color:#475569;">This code expires in 10 minutes. Do not share it with anyone.</p>`,
    bodyText: `Your verification code is ${code}. It expires in 10 minutes. Do not share it.`,
  });
}

export function passwordResetTemplate(resetUrl: string): { html: string; text: string } {
  const safeUrl = resetUrl.replace(/"/g, '&quot;');
  return renderBrandedEmail({
    title: 'Reset your password',
    preheader: 'ClearClever password reset request',
    bodyHtml: `<p style="margin:0 0 16px;color:#475569;">We received a request to reset your ClearClever password. Click the button below to choose a new password.</p>
      <p style="margin:0 0 20px;"><a href="${safeUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;">Reset your password</a></p>
      <p style="margin:0 0 12px;color:#475569;">This link expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
      <p style="margin:0;color:#64748B;font-size:13px;">If the button does not work, copy and paste this link into your browser:<br/><span style="word-break:break-all;">${safeUrl}</span></p>`,
    bodyText: `Reset your ClearClever password: ${resetUrl}\n\nThis link expires in 10 minutes. If you did not request a password reset, ignore this email.`,
  });
}
