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

const { lookupContextWindow, lookupModelLimits } =
    await import('@main/services/ai/model-context-registry');

// ── Fixtures ──

const OPEN_ROUTER_MODELS = [
    {
        id: 'openai/gpt-5-mini',
        context_length: 128_000,
        top_provider: { max_completion_tokens: 16_384 },
    },
    { id: 'openai/gpt-5', context_length: 400_000 },
    { id: 'openai/gpt-4.1-mini', context_length: 1_047_576 },
    { id: 'anthropic/claude-sonnet-4-6', context_length: 1_000_000 },
    { id: 'qwen/qwen3.6-plus:free', context_length: 1_000_000 },
    { id: 'ibm-granite/granite-4.1-8b', context_length: 128_000 },
    { id: 'ibm-granite/granite-4.1-2b', context_length: 32_000 },
    { id: 'meta-llama/llama-3.3-70b-instruct', context_length: 128_000 },
    { id: 'meta-llama/llama-3.3-8b-instruct', context_length: 32_000 },
    { id: 'qwen/qwen3.5-27b', context_length: 262_144 },
    { id: 'qwen/qwen3.5-9b', context_length: 131_072 },
    { id: 'deepseek/deepseek-r1', context_length: 128_000 },
    { id: 'google/gemma-3-27b-it', context_length: 128_000 },
    { id: 'microsoft/phi-4-mini', context_length: 128_000 },
    { id: 'mistralai/mistral-large-latest', context_length: 128_000 },
    { id: 'microsoft/phi-4', context_length: 16_384 },
    { id: 'deepseek/deepseek-coder-v2', context_length: 128_000 },
    { id: 'openai/top-provider-context-only', top_provider: { context_length: 64_000 } },
];

const MODELS_DEV_REGISTRY: Record<string, { contextWindow?: number; maxOutputTokens?: number }> = {
    'groq/llama-3.3-70b-versatile': { contextWindow: 128_000 },
    'anyscale/mistralai/Mixtral-8x22B-Instruct-v0.1': { contextWindow: 65_536 },
    'together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo': { contextWindow: 32_768 },
    'ollama/deepseek-coder-v2-lite-instruct': { contextWindow: 32_768 },
    'ollama/bakllava': { contextWindow: 4_096 },
    'ollama/phi3': { contextWindow: 128_000 },
};

// ── Helpers ──

function setupOpenRouter() {
    let callCount = 0;
    getMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? OPEN_ROUTER_MODELS : null;
    });
}

function setupModelsDev() {
    let callCount = 0;
    getMock.mockImplementation(() => {
        callCount++;
        return callCount === 2 ? MODELS_DEV_REGISTRY : null;
    });
}

function setupBoth() {
    let callCount = 0;
    getMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return OPEN_ROUTER_MODELS;
        if (callCount === 2) return MODELS_DEV_REGISTRY;
        return null;
    });
}

// ── Tests ──

describe('model-context-registry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMock.mockReturnValue(null);
        getStaleMock.mockReturnValue(null);
        getOrFetchMock.mockResolvedValue(undefined);
    });

    describe('plain model IDs', () => {
        it('matches gpt-5-mini', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('gpt-5-mini')).toBe(128_000);
        });

        it('matches OpenRouter-prefixed ID', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('openai/gpt-5-mini')).toBe(128_000);
        });

        it('prefers exact match over prefix sibling', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('gpt-5')).toBe(400_000);
        });

        it('matches Anthropic model', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('claude-sonnet-4-6')).toBe(1_000_000);
        });

        it('matches OpenRouter free-tier suffix IDs', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('qwen/qwen3.6-plus:free')).toBe(1_000_000);
        });

        it('returns context and output limits from OpenRouter', async () => {
            setupOpenRouter();
            expect(await lookupModelLimits('gpt-5-mini', 'openai')).toEqual({
                contextWindow: 128_000,
                maxOutputTokens: 16_384,
            });
        });

        it('falls back to top_provider context length when root context length is missing', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('top-provider-context-only')).toBe(64_000);
        });
    });

    describe('Ollama param-size-aware matching', () => {
        it('qwen3.5:9b matches qwen3.5-9b (not qwen3.5-27b)', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('qwen3.5:9b')).toBe(131_072);
        });

        it('granite4.1:8b matches granite-4.1-8b with inserted family/version separator', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('granite4.1:8b')).toBe(128_000);
        });

        it('granite4.1:2b keeps the parameter size specific', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('granite4.1:2b')).toBe(32_000);
        });

        it('qwen3.5:27b matches qwen3.5-27b', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('qwen3.5:27b')).toBe(262_144);
        });

        it('llama-3.3-70b-instruct:q4_K_M strips quantization, matches 70b', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('llama-3.3-70b-instruct:q4_K_M')).toBe(128_000);
        });

        it('deepseek-r1:14b matches deepseek-r1 (prefix match, no 14b entry)', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('deepseek-r1:14b')).toBe(128_000);
        });

        it('phi-4:latest strips :latest, matches phi-4', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('phi-4:latest')).toBe(16_384);
        });

        it('prefers phi-4 exact match over phi-4-mini sibling', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('phi-4')).toBe(16_384);
        });

        it('gemma-3:27b matches gemma-3-27b-it via prefix', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('gemma-3:27b')).toBe(128_000);
        });

        it('bakllava:7b falls through to models.dev', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('bakllava:7b')).toBe(4_096);
        });
    });

    describe('Ollama complex tags', () => {
        it('deepseek-coder-v2:16b-lite-instruct-q2_K extracts variant from tag', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('deepseek-coder-v2:16b-lite-instruct-q2_K')).toBe(
                32_768,
            );
        });

        it('deepseek-coder-v2:latest matches base name', async () => {
            setupBoth();
            expect(await lookupContextWindow('deepseek-coder-v2:latest')).toBe(128_000);
        });

        it('phi3:latest matches models.dev ollama/phi3', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('phi3:latest')).toBe(128_000);
        });
    });

    describe('models.dev fallback', () => {
        it('matches by base name across providers', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('llama-3.3-70b-versatile')).toBe(128_000);
        });

        it('matches deeply nested keys', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('Mixtral-8x22B-Instruct-v0.1')).toBe(65_536);
        });

        it('matches Ollama :latest tag against models.dev', async () => {
            setupModelsDev();
            expect(await lookupContextWindow('Qwen2.5-72B-Instruct-Turbo:latest')).toBe(32_768);
        });
    });

    describe('case insensitivity', () => {
        it('matches regardless of case', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('GPT-5-MINI')).toBe(128_000);
        });

        it('matches mixed case Ollama tags', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('Qwen3.5:9B')).toBe(131_072);
        });
    });

    describe('edge cases', () => {
        it('returns undefined for unknown model', async () => {
            setupBoth();
            expect(await lookupContextWindow('totally-unknown-model')).toBeUndefined();
        });

        it('returns undefined for obscure fine-tunes not in registries', async () => {
            setupBoth();
            expect(await lookupContextWindow('dolphin-llama3:8b')).toBeUndefined();
        });

        it('returns undefined when both registries are empty', async () => {
            expect(await lookupContextWindow('gpt-5-mini')).toBeUndefined();
        });

        it('prefers OpenRouter over models.dev when both have the model', async () => {
            setupBoth();
            expect(await lookupContextWindow('llama-3.3-70b-instruct')).toBe(128_000);
        });

        it('does not prefix-match plain model ids to sibling models', async () => {
            setupOpenRouter();
            expect(await lookupContextWindow('gpt-4.1')).toBeUndefined();
        });
    });
});
