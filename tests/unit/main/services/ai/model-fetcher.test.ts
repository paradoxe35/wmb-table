import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '@shared/ai.types';

const cacheGetMock = vi.fn();
const cacheGetStaleMock = vi.fn();
const cacheSetMock = vi.fn();
const cacheKeys: string[] = [];

vi.mock('@main/lib/simple-cache', () => ({
    SimpleCache: class {
        constructor(key: string) {
            cacheKeys.push(key);
        }

        get = cacheGetMock;
        getStale = cacheGetStaleMock;
        set = cacheSetMock;
    },
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { fetchProviderModels, getModelContextWindow } =
    await import('@main/services/ai/model-fetcher');

function createSettings(): AiSettings {
    return {
        enabled: true,
        activeProvider: 'custom-a',
        languagePreference: 'active',
        maxHistoryConversations: 20,
        providers: {
            local: { enabled: true, model: null },
            openrouter: { enabled: true, model: 'openai/gpt-5-mini', apiKey: 'or-key' },
            openai: { enabled: true, model: 'gpt-5-mini', apiKey: 'oa-key' },
            gemini: { enabled: true, model: 'gemini-2.5-flash', apiKey: 'gm-key' },
            claude: { enabled: true, model: 'claude-haiku-4-5', apiKey: 'cl-key' },
        },
        customProviders: [
            {
                id: 'custom-a',
                name: 'Custom A',
                baseUrl: 'https://example-a.test/v1',
                apiKey: 'custom-key',
                defaultModel: 'model-a',
                model: 'model-a',
            },
        ],
    };
}

describe('model-fetcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cacheKeys.length = 0;
        cacheGetMock.mockReturnValue(null);
        cacheGetStaleMock.mockReturnValue(null);
        cacheSetMock.mockImplementation(() => undefined);
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [{ id: 'model-a', name: 'Model A', context_length: 123_456 }],
            }),
        }) as typeof fetch;
    });

    it('isolates model list cache by custom provider baseUrl', async () => {
        const settings = createSettings();

        await fetchProviderModels(settings, {
            providerId: 'custom-a',
            baseUrl: 'https://example-a.test/v1',
        });
        await fetchProviderModels(settings, {
            providerId: 'custom-a',
            baseUrl: 'https://example-b.test/v1',
        });

        expect(cacheKeys).toEqual([
            'ai-models:custom-a:https%3A%2F%2Fexample-a.test%2Fv1',
            'ai-models:custom-a:https%3A%2F%2Fexample-b.test%2Fv1',
        ]);
    });

    it('uses the same baseUrl-aware cache key when resolving context window', async () => {
        cacheGetMock.mockReturnValue([{ id: 'model-a', name: 'Model A', contextWindow: 123_456 }]);

        const contextWindow = await getModelContextWindow(
            'custom-a',
            'model-a',
            'https://example-a.test/v1',
        );

        expect(contextWindow).toBe(123_456);
        expect(cacheKeys).toEqual(['ai-models:custom-a:https%3A%2F%2Fexample-a.test%2Fv1']);
    });
});
