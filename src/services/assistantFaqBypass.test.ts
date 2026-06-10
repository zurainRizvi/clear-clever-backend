import { tryAssistantFaqBypass } from './assistantFaqBypass';

describe('assistantFaqBypass', () => {
  const base = {
    audience: 'public' as const,
    hasAttachments: false,
    hasPriorAssistantReply: false,
  };

  it('matches what is clearclever', () => {
    const reply = tryAssistantFaqBypass({
      ...base,
      message: 'What is ClearClever?',
    });
    expect(reply).toContain('ClearClever');
    expect(reply).toContain('Pakistan');
  });

  it('skips when attachments are present', () => {
    expect(
      tryAssistantFaqBypass({
        ...base,
        message: 'What is ClearClever?',
        hasAttachments: true,
      })
    ).toBeUndefined();
  });

  it('skips long non-faq messages', () => {
    expect(
      tryAssistantFaqBypass({
        ...base,
        message: 'a'.repeat(201),
      })
    ).toBeUndefined();
  });

  it('limits sign-in benefits to public audience', () => {
    expect(
      tryAssistantFaqBypass({
        ...base,
        message: 'Why should I sign in?',
      })
    ).toBeTruthy();

    expect(
      tryAssistantFaqBypass({
        ...base,
        audience: 'seeker',
        message: 'Why should I sign in?',
      })
    ).toBeUndefined();
  });

  it('adds greeting on first reply when addressing is set', () => {
    const reply = tryAssistantFaqBypass({
      ...base,
      message: 'How does scoring work?',
      addressing: { fullName: 'Ali Khan', firstName: 'Ali' },
    });
    expect(reply).toMatch(/^Hello, \*\*Ali Khan\*\*!/);
  });
});
