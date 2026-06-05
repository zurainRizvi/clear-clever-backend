import { PRODUCTION_CLIENT_URL } from './services/clientUrls';
import { renderBrandedEmail, otpTemplate, passwordResetTemplate } from './services/emailTemplates';
import { renderClearCleverEmail } from './services/clearCleverEmailLayout';
import { policyCompletionMilestoneEmail, premiumReminderEmail } from './services/reminderTemplates';
import { reminderEmailContent } from './services/reminderEmailVariants';

describe('ClearClever email templates', () => {
  it('renders logo, hero, features, and footer in premium email', () => {
    const due = new Date(Date.UTC(2026, 5, 15));
    const { html, subject } = premiumReminderEmail('Home Shield Plan', due, 10);
    expect(subject).toContain('10 days');
    expect(html).toContain('ClearClever');
    expect(html).toContain('Due in 10 days');
    expect(html).toContain('Plan ahead for your');
    expect(html).toContain('Comprehensive coverage');
    expect(html).toContain('Contact Support');
    expect(html).toContain('images.unsplash.com');
    expect(html).toContain(`${PRODUCTION_CLIENT_URL}/dashboard/purchases`);
    expect(html).toContain('/brand/clearclever-logo-horizontal.svg');
  });

  it('uses distinct gradients per premium cadence', () => {
    const due = new Date(Date.UTC(2026, 5, 15));
    const t10 = premiumReminderEmail('Plan A', due, 10).html;
    const dueToday = premiumReminderEmail('Plan A', due, 0).html;
    expect(t10).toContain('#0037D6');
    expect(dueToday).toContain('#B91C1C');
    expect(t10).not.toEqual(dueToday);
  });

  it('renders completion milestone like marketing layout', () => {
    const { html } = policyCompletionMilestoneEmail('Home Shield Plan');
    const content = reminderEmailContent('policy_completion_d7', { policyName: 'Home Shield Plan' });
    expect(html).toContain(content.heading);
    expect(html).toContain('One-week check-in');
    expect(html).toContain('coverage');
    expect(html).toContain('View policy details');
    expect(html).toContain(`${PRODUCTION_CLIENT_URL}/dashboard/purchases`);
    expect(html).toContain(`${PRODUCTION_CLIENT_URL}/dashboard`);
  });

  it('routes insurer approval CTAs to provider dashboard', () => {
    const { html } = renderClearCleverEmail(
      reminderEmailContent('approval_pending_insurer', { policyName: 'Test Policy' }),
      { clientBaseUrl: PRODUCTION_CLIENT_URL }
    );
    expect(html).toContain(`${PRODUCTION_CLIENT_URL}/provider-dashboard/policies`);
    expect(html).toContain(`${PRODUCTION_CLIENT_URL}/provider-dashboard`);
  });

  it('escapes policy names in HTML', () => {
    const due = new Date(Date.UTC(2026, 5, 15));
    const { html } = premiumReminderEmail('<script>alert(1)</script>', due, 7);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders OTP with code in detail block', () => {
    const { html, text } = otpTemplate('654321');
    expect(html).toContain('654321');
    expect(text).toContain('654321');
    expect(html).toContain('Secure verification');
  });

  it('renders password reset link in branded email', () => {
    const resetUrl = `${PRODUCTION_CLIENT_URL}/reset-password?token=abc123`;
    const { html, text } = passwordResetTemplate(resetUrl);
    expect(html).toContain('Reset your password');
    expect(html).toContain(resetUrl);
    expect(text).toContain(resetUrl);
    expect(html).toContain('expires in 10 minutes');
  });

  it('renders branded transactional shell', () => {
    const { html } = renderBrandedEmail({
      title: 'Policy purchase confirmed',
      preheader: 'Thanks for your purchase',
      bodyHtml: '<p>Your policy is active.</p>',
      bodyText: 'Your policy is active.',
    });
    expect(html).toContain('Policy purchase confirmed');
    expect(html).toContain('Your policy is active.');
  });

  it('highlights keyword in heading', () => {
    const { html } = renderClearCleverEmail({
      preheader: 'test',
      headerLabel: 'Test',
      badge: 'Badge',
      heading: 'Hello coverage world',
      highlightWord: 'coverage',
      paragraph: 'Body',
      heroGradient: 'linear-gradient(#000,#111)',
      heroShadow: 'none',
      heroImageUrl: 'https://example.com/x.jpg',
      heroImageAlt: 'alt',
      primaryCta: { label: 'Go', href: 'https://example.com' },
      features: [],
    });
    expect(html).toContain('color:#4DA3FF');
    expect(html).toContain('coverage');
  });
});
