import { CLEARCLEVER_LOGO_SVG } from './emailAssets';

export interface EmailFeatureItem {
  emoji: string;
  title: string;
  description: string;
  iconBackground: string;
}

export interface EmailCta {
  label: string;
  href: string;
}

export interface ClearCleverEmailContent {
  preheader: string;
  headerLabel: string;
  badge: string;
  heading: string;
  highlightWord: string;
  highlightColor?: string;
  paragraph: string;
  heroGradient: string;
  heroShadow: string;
  heroImageUrl: string;
  heroImageAlt: string;
  primaryCta: EmailCta;
  secondaryCta?: EmailCta;
  features: EmailFeatureItem[];
  footerSupport?: string;
  policyName?: string;
  /** Optional HTML block between hero and feature strip (e.g. OTP code). */
  detailHtml?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headingWithHighlight(
  heading: string,
  highlightWord: string,
  highlightColor: string
): string {
  const safeHeading = escapeHtml(heading);
  const safeWord = escapeHtml(highlightWord);
  if (!safeHeading.includes(safeWord)) {
    return safeHeading;
  }
  return safeHeading.replace(
    safeWord,
    `<span style="color:${highlightColor};">${safeWord}</span>`
  );
}

function renderFeatureCell(item: EmailFeatureItem): string {
  return `
    <td width="25%" valign="top" style="padding:8px 6px;text-align:center;font-family:Inter,Arial,sans-serif;">
      <div style="width:44px;height:44px;line-height:44px;margin:0 auto 10px;border-radius:12px;background:${item.iconBackground};font-size:20px;text-align:center;">
        ${item.emoji}
      </div>
      <div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.35;margin-bottom:4px;">${escapeHtml(item.title)}</div>
      <div style="font-size:12px;color:#64748B;line-height:1.45;">${escapeHtml(item.description)}</div>
    </td>`;
}

function renderCtaButton(
  cta: EmailCta,
  variant: 'primary' | 'secondary'
): string {
  const safeHref = escapeHtml(cta.href);
  const safeLabel = escapeHtml(cta.label);
  if (variant === 'primary') {
    return `
      <td style="padding-right:10px;">
        <a href="${safeHref}" style="display:inline-block;background:#2D7EFF;color:#FFFFFF;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 22px;border-radius:14px;box-shadow:0 12px 30px rgba(45,126,255,0.35);">
          ${safeLabel} &rarr;
        </a>
      </td>`;
  }
  return `
    <td>
      <a href="${safeHref}" style="display:inline-block;background:rgba(255,255,255,0.08);color:#FFFFFF;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 22px;border-radius:14px;border:1px solid rgba(255,255,255,0.28);">
        ${safeLabel}
      </a>
    </td>`;
}

/**
 * Premium table-based marketing email (Gmail / Apple Mail / Outlook-friendly).
 */
export function renderClearCleverEmail(
  content: ClearCleverEmailContent,
  options?: { supportUrl?: string }
): { html: string; text: string } {
  const highlightColor = content.highlightColor ?? '#4DA3FF';
  const supportUrl = options?.supportUrl ?? 'https://clearclever.vercel.app/contact';
  const policyLine = content.policyName
    ? `<p style="margin:0 0 14px;font-family:Inter,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.65);">Policy: <strong style="color:#FFFFFF;">${escapeHtml(content.policyName)}</strong></p>`
    : '';

  const headingHtml = headingWithHighlight(
    content.heading,
    content.highlightWord,
    highlightColor
  );

  const secondaryCtaRow = content.secondaryCta
    ? renderCtaButton(content.secondaryCta, 'secondary')
    : '';

  const featureCells = content.features.map(renderFeatureCell).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(content.heading)}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F4F7FB;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(content.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7FB;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:820px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 8px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:12px;">
                          <img src="${CLEARCLEVER_LOGO_SVG}" width="44" height="44" alt="ClearClever" style="display:block;border:0;" />
                        </td>
                        <td valign="middle" style="font-family:Inter,Arial,sans-serif;font-size:28px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">
                          ClearClever
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:500;color:#64748B;">
                    ${escapeHtml(content.headerLabel)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero card -->
          <tr>
            <td style="border-radius:28px 28px 0 0;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${content.heroGradient};border-radius:28px 28px 0 0;box-shadow:${content.heroShadow};">
                <tr>
                  <td style="padding:40px 36px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="56%" valign="top" style="padding-right:12px;">
                          <div style="display:inline-block;background:rgba(255,255,255,0.14);color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:600;padding:9px 16px;border-radius:999px;margin-bottom:18px;">
                            ${escapeHtml(content.badge)}
                          </div>
                          <h1 style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:38px;line-height:1.08;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">
                            ${headingHtml}
                          </h1>
                          ${policyLine}
                          <p style="margin:0 0 22px;font-family:Inter,Arial,sans-serif;font-size:17px;line-height:1.65;color:rgba(255,255,255,0.8);">
                            ${escapeHtml(content.paragraph)}
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              ${renderCtaButton(content.primaryCta, 'primary')}
                              ${secondaryCtaRow}
                            </tr>
                          </table>
                        </td>
                        <td width="44%" valign="middle" align="center" style="padding-left:8px;">
                          <img src="${escapeHtml(content.heroImageUrl)}" alt="${escapeHtml(content.heroImageAlt)}" width="280" style="display:block;width:100%;max-width:280px;height:auto;border:0;border-radius:18px;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            content.detailHtml
              ? `<tr>
            <td style="background:#FFFFFF;padding:8px 28px 4px;border-left:1px solid rgba(15,23,42,0.04);border-right:1px solid rgba(15,23,42,0.04);">
              <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.65;color:#0F172A;">
                ${content.detailHtml}
              </div>
            </td>
          </tr>`
              : ''
          }
          <!-- Feature strip -->
          <tr>
            <td style="background:#FFFFFF;border-radius:0 0 24px 24px;border-top:1px solid rgba(15,23,42,0.06);box-shadow:0 20px 60px rgba(15,23,42,0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 20px 28px;">
                <tr>
                  ${featureCells}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 12px 8px;font-family:Inter,Arial,sans-serif;">
              <p style="margin:0 0 10px;font-size:15px;color:#64748B;line-height:1.5;">
                ${escapeHtml(content.footerSupport ?? 'Need help? Our support team is here for you.')}
              </p>
              <a href="${escapeHtml(supportUrl)}" style="font-size:15px;font-weight:600;color:#2563EB;text-decoration:none;">
                Contact Support &rarr;
              </a>
              <p style="margin:18px 0 0;font-size:12px;color:#94A3B8;line-height:1.5;">
                &copy; ${new Date().getUTCFullYear()} ClearClever. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'ClearClever',
    content.headerLabel,
    '',
    content.badge,
    content.heading,
    content.policyName ? `Policy: ${content.policyName}` : '',
    content.paragraph,
    '',
    `${content.primaryCta.label}: ${content.primaryCta.href}`,
    content.secondaryCta ? `${content.secondaryCta.label}: ${content.secondaryCta.href}` : '',
    '',
    ...content.features.map((f) => `${f.title} — ${f.description}`),
    '',
    content.footerSupport ?? 'Need help? Contact support.',
    supportUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}
