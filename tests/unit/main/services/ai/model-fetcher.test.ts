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
        getOrFetch = async () => this.get();
        set = (value: unknown) => {
            cacheData.set(this.key, value);
            cacheSetCalls.push({ key: this.key, value });
        };
    },
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { fetchProviderModels, getModelContextWindow, getModelLimits } =
    await import('@main/services/ai/model-fetcher');

function createSettings(): AiSettings {
    return {
        enabled: true,
        activeProvider: 'custom-a',
        languagePreference: 'active',
        maxHistoryConversations: 20,
        providers: {
            openrouter: { enabled: true, model: 'openai/gpt-5-mini', apiKey: 'or-key' },
            openai: { enabled: true, model: 'gpt-5-mini', apiKey: 'oa-key' },
            gemini: { enabled: true, model: 'gemini-2.5-flash', apiKey: 'gm-key' },
            claude: { enabled: true, model: 'claude-haiku-4-5', apiKey: 'cl-key' },
            ollama: { enabled: true, model: 'llama3.2' },
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
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            'ai-models:custom-a:https%3A%2F%2Fexample-b.test%2Fv1',
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-b.test%2Fv1:model-a',
        ]);
    });

    it('uses top_provider context length when the root context length is missing', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: 'model-a',
                        name: 'Model A',
                        top_provider: {
                            context_length: 123_456,
                            max_completion_tokens: 4_096,
                        },
                    },
                ],
            }),
        }) as typeof fetch;

        const models = await fetchProviderModels(createSettings(), {
            providerId: 'custom-a',
            baseUrl: 'https://example-a.test/v1',
        });

        expect(models).toEqual([
            {
                id: 'model-a',
                name: 'Model A',
                contextWindow: 123_456,
                maxOutputTokens: 4_096,
            },
        ]);
        expect(cacheSetCalls).toContainEqual({
            key: 'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            value: 123_456,
        });
        expect(cacheSetCalls).toContainEqual({
            key: 'ai-model-output:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            value: 4_096,
        });
    });

    it('fetches Ollama models from the configured OpenAI-compatible base URL without an API key', async () => {
        const settings = createSettings();
        settings.providers.ollama.baseUrl = 'http://localhost:11434/v1';

        const models = await fetchProviderModels(settings, {
            providerId: 'ollama',
        });

        expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:11434/v1/models', {
            headers: {},
        });
        expect(models).toEqual([
            {
                id: 'model-a',
                name: 'Model A',
                contextWindow: 123_456,
                maxOutputTokens: undefined,
            },
        ]);
    });

    it('checks the dedicated model context cache before the model list cache', async () => {
        cacheData.set(
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            123_456,
        );

        const contextWindow = await getModelContextWindow(
            'custom-a',
            'model-a',
            'https://example-a.test/v1',
        );

        expect(contextWindow).toBe(123_456);
        expect(cacheKeys).toEqual([
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
        ]);
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
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            'ai-models:custom-a:https%3A%2F%2Fexample-a.test%2Fv1',
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
        ]);
        expect(cacheSetCalls).toContainEqual({
            key: 'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            value: 123_456,
        });
    });

    it('does not reuse context/output limits across custom provider baseUrls', async () => {
        cacheData.set(
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            123_456,
        );
        cacheData.set(
            'ai-model-output:custom-a%3Ahttps%3A%2F%2Fexample-a.test%2Fv1:model-a',
            4_096,
        );
        cacheData.set('ai-models:custom-a:https%3A%2F%2Fexample-b.test%2Fv1', [
            {
                id: 'model-a',
                name: 'Model A',
                contextWindow: 8_192,
                maxOutputTokens: 1_024,
            },
        ]);

        const limits = await getModelLimits('custom-a', 'model-a', 'https://example-b.test/v1');

        expect(limits).toEqual({ contextWindow: 8_192, maxOutputTokens: 1_024 });
        expect(cacheKeys).toContain(
            'ai-model-context:custom-a%3Ahttps%3A%2F%2Fexample-b.test%2Fv1:model-a',
        );
        expect(cacheKeys).not.toContain('ai-model-context:model-a');
    });
});
