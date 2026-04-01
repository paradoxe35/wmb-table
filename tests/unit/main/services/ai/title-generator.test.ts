import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();

vi.mock('ai', () => ({
    generateText: generateTextMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { generateConversationTitle } = await import('@main/services/ai/title-generator');

describe('title-generator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the configured output budget for title generation', async () => {
        generateTextMock.mockResolvedValue({ text: 'Revelation 10 study' });

        const title = await generateConversationTitle({} as never, 'en', 'fr', [
            { role: 'user', content: 'Tell me about Revelation 10.' },
        ]);

        expect(title).toBe('Revelation 10 study');
        expect(generateTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                maxOutputTokens: 1024,
            }),
        );
    });
});
