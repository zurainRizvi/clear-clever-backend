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
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; background:#F5F8FF; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #E2E8F0; border-radius:14px; overflow:hidden;">
        <div style="padding:18px 20px; background:linear-gradient(90deg, #1D4ED8, #2563EB); color:#fff;">
          <div style="font-size:20px; font-weight:700;">ClearClever</div>
          <div style="font-size:12px; opacity:0.9; margin-top:4px;">${preheader}</div>
        </div>
        <div style="padding:22px 20px; color:#0F172A;">
          <h2 style="margin:0 0 12px; font-size:22px;">${title}</h2>
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
  const text = [`ClearClever`, preheader, "", title, "", bodyText].join("\n");
  return { html, text };
}

export function otpTemplate(code: string): { html: string; text: string } {
  return renderBrandedEmail({
    title: "Your verification code",
    preheader: "Secure sign-in verification",
    bodyHtml: `<p>Your verification code is:</p>
      <p style="font-size:28px; font-weight:700; letter-spacing:4px; margin:12px 0;">${code}</p>
      <p style="color:#475569;">This code expires in 10 minutes. Do not share it.</p>`,
    bodyText: `Your verification code is ${code}. It expires in 10 minutes. Do not share it.`,
  });
}
