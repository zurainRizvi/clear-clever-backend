import { attachmentsToGeminiParts, parseAttachments } from './assistantAttachments';

describe('assistantAttachments', () => {
  it('maps attachments to Gemini camelCase inlineData parts', () => {
    const parsed = parseAttachments([
      {
        mimeType: 'image/png',
        fileName: 'policy.png',
        dataBase64: 'aGVsbG8=',
      },
    ]);

    const parts = attachmentsToGeminiParts(parsed);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: 'aGVsbG8=',
      },
    });
  });
});
