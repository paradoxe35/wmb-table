import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const getStaleMock = vi.fn();
const getOrFetchMock = vi.fn();

vi.mock('@main/lib/simple-cache', () => ({
    SimpleCache: class {
        get = getMock;
        getStale = getStaleMock;
        getOrFetch = getOrFetchMock;
    },
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { lookupContextWindow } = await import('@main/services/ai/model-context-registry');

describe('model-context-registry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMock.mockReturnValue(null);
        getStaleMock.mockReturnValue(null);
        getOrFetchMock.mockResolvedValue(undefined);
    });

    describe('OpenRouter lookup', () => {
        const openRouterModels = [
            { id: 'openai/gpt-5-mini', context_length: 128_000 },
            { id: 'anthropic/claude-sonnet-4-6', context_length: 1_000_000 },
            { id: 'meta-llama/llama-3.3-70b-instruct', context_length: 128_000 },
            { id: 'qwen/qwen-2.5-72b-instruct', context_length: 128_000 },
        ];

        function setupOpenRouter() {
            let callCount = 0;
            getMock.mockImplementation(() => {
                callCount++;
                return callCount === 1 ? openRouterModels : null;
            });
        }

        it('matches plain model ID', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('gpt-5-mini')).toBe(128_000);
        });

        it('matches OpenRouter-prefixed ID', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('openai/gpt-5-mini')).toBe(128_000);
        });

        it('matches Ollama-style ID (strips :tag)', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('llama-3.3-70b-instruct:q4_K_M')).toBe(128_000);
        });

        it('matches -instruct variant', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('llama-3.3-70b')).toBe(128_000);
        });

        it('returns undefined for unknown model', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('totally-unknown-model')).toBeUndefined();
        });
    });

    describe('LiteLLM fallback', () => {
        const litellmRegistry: Record<string, number> = {
            'groq/llama-3.3-70b-versatile': 128_000,
            'anyscale/mistralai/Mixtral-8x22B-Instruct-v0.1': 65_536,
            'together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo': 32_768,
        };

        function setupLiteLLM() {
            let callCount = 0;
            getMock.mockImplementation(() => {
                callCount++;
                return callCount === 2 ? litellmRegistry : null;
            });
        }

        it('matches by base name across providers', async () => {
            setupLiteLLM();
            expect(await lookupContextWindow('llama-3.3-70b-versatile')).toBe(128_000);
        });

        it('matches deeply nested keys', async () => {
            setupLiteLLM();
            expect(await lookupContextWindow('Mixtral-8x22B-Instruct-v0.1')).toBe(65_536);
        });

        it('matches Ollama-style against LiteLLM', async () => {
            setupLiteLLM();
            expect(await lookupContextWindow('Qwen2.5-72B-Instruct-Turbo:latest')).toBe(32_768);
        });
    });
});
