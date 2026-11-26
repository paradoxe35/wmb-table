import { beforeEach, describe, expect, it, vi } from 'vitest';

const getModelReasoningSupportMock = vi.fn();

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@main/database/repositories/config.repository', () => ({}));
vi.mock('@main/services/language-pack.service', () => ({}));
vi.mock('@main/services/bible.service', () => ({}));
vi.mock('@main/services/ai/provider-resolver', () => ({}));
vi.mock('@main/services/ai/model-fetcher', () => ({
    getModelLimits: vi.fn(),
    getModelReasoningSupport: getModelReasoningSupportMock,
}));

const { supportsReasoningControl } = await import('@main/services/ai/generation-environment');

describe('supportsReasoningControl', () => {
    beforeEach(() => {
        getModelReasoningSupportMock.mockReset();
    });

    it.each([
        ['openai', 'gpt-5-mini', true],
        ['openai', 'gpt-5.1', true],
        ['openai', 'o4-mini', true],
        ['openai', 'gpt-5-chat-latest', false],
        ['openai', 'gpt-4.1-mini', false],
        ['gemini', 'gemini-2.5-flash', true],
        ['gemini', 'gemini-3-pro-preview', true],
        ['gemini', 'gemini-2.0-flash', false],
        ['claude', 'claude-sonnet-4-6', false],
    ])('%s %s → %s', async (providerId, modelId, expected) => {
        expect(await supportsReasoningControl(providerId, modelId)).toBe(expected);
        expect(getModelReasoningSupportMock).not.toHaveBeenCalled();
    });

    it.each([
        ['openrouter', 'deepseek/deepseek-r1:free', true, true],
        ['openrouter', 'meta-llama/llama-3.3-8b-instruct:free', false, false],
        ['ollama', 'llama3.2', undefined, false],
        ['mock-llm', 'mock-model', undefined, false],
        ['mock-llm', 'qwen3-thinking', true, true],
    ])('%s %s follows the model list (%s)', async (providerId, modelId, listed, expected) => {
        getModelReasoningSupportMock.mockResolvedValue(listed);

        expect(await supportsReasoningControl(providerId, modelId, 'http://127.0.0.1:1/v1')).toBe(
            expected,
        );
        expect(getModelReasoningSupportMock).toHaveBeenCalledWith(
            providerId,
            modelId,
            'http://127.0.0.1:1/v1',
        );
    });
});
