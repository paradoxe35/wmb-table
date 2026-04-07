import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '@shared/ai.types';

const cacheKeys: string[] = [];
const cacheData = new Map<string, unknown>();
const cacheSetCalls: Array<{ key: string; value: unknown }> = [];

function resetCache(): void {
    cacheKeys.length = 0;
    cacheData.clear();
    cacheSetCalls.length = 0;
}

vi.mock('@main/lib/simple-cache', () => ({
    SimpleCache: class {
        private readonly key: string;

        constructor(key: string) {
            this.key = key;
            cacheKeys.push(key);
        }

        get = () => (cacheData.has(this.key) ? cacheData.get(this.key) : null);
        getStale = () => (cacheData.has(this.key) ? cacheData.get(this.key) : null);
        set = (value: unknown) => {
            cacheData.set(this.key, value);
            cacheSetCalls.push({ key: this.key, value });
        };
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
        resetCache();
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
            'ai-model-context:model-a',
            'ai-models:custom-a:https%3A%2F%2Fexample-b.test%2Fv1',
            'ai-model-context:model-a',
        ]);
    });

    it('checks the dedicated model context cache before the model list cache', async () => {
        cacheData.set('ai-model-context:model-a', 123_456);

        const contextWindow = await getModelContextWindow(
            'custom-a',
            'model-a',
            'https://example-a.test/v1',
        );

        expect(contextWindow).toBe(123_456);
        expect(cacheKeys).toEqual(['ai-model-context:model-a']);
    });

    it('persists a permanent model context cache entry from the model list cache', async () => {
        cacheData.set('ai-models:custom-a:https%3A%2F%2Fexample-a.test%2Fv1', [
            { id: 'model-a', name: 'Model A', contextWindow: 123_456 },
        ]);

        const contextWindow = await getModelContextWindow(
            'custom-a',
            'model-a',
            'https://example-a.test/v1',
        );

        expect(contextWindow).toBe(123_456);
        expect(cacheKeys).toEqual([
            'ai-model-context:model-a',
            'ai-models:custom-a:https%3A%2F%2Fexample-a.test%2Fv1',
            'ai-model-context:model-a',
        ]);
        expect(cacheSetCalls).toContainEqual({
            key: 'ai-model-context:model-a',
            value: 123_456,
        });
    });
});
