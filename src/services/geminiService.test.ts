import { buildGeminiContentsForTest } from './geminiService';

describe('geminiService', () => {
  it('serializes attachment parts as inline_data for the REST API', () => {
    const contents = buildGeminiContentsForTest({
      userMessage: 'What is in this image?',
      attachmentParts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'abc123',
          },
        },
      ],
    });

    expect(contents).toHaveLength(1);
    expect(contents[0]?.parts).toEqual([
      {
        inline_data: {
          mime_type: 'image/jpeg',
          data: 'abc123',
        },
      },
      { text: 'What is in this image?' },
    ]);
  });
});
