import log from '@main/lib/logger';
import { SimpleCache } from '@main/lib/simple-cache';
import type { AiRemoteModel, AiSettings } from '@shared/ai.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';
import { lookupContextWindow } from './model-context-registry';

// ── Constants ──

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const BUILTIN_BASE_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    claude: 'https://api.anthropic.com/v1',
};

// ── Credential resolution ──

interface ResolvedCredentials {
    apiKey: string | undefined;
    baseUrl: string | undefined;
}

function resolveCredentials(
    settings: AiSettings,
    providerId: string,
    input: { apiKey?: string; baseUrl?: string },
): ResolvedCredentials {
    if ((BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId)) {
        const config = settings.providers[providerId as keyof AiSettings['providers']];
        return { apiKey: input.apiKey ?? config?.apiKey, baseUrl: undefined };
    }

    const custom = settings.customProviders.find((p) => p.id === providerId);
    if (custom) {
        return {
            apiKey: input.apiKey ?? custom.apiKey,
            baseUrl: input.baseUrl ?? custom.baseUrl,
        };
    }

    return { apiKey: input.apiKey, baseUrl: input.baseUrl };
}

// ── Helpers ──

function toPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 ? Math.floor(value) : undefined;
}

const NON_CHAT_PATTERNS = /\b(embed|embedding|tts|whisper|dall-e|stable-diffusion|rerank)\b/i;

function isChatModel(modelId: string): boolean {
    return !NON_CHAT_PATTERNS.test(modelId);
}

// ── Provider API response types ──

interface GeminiModelEntry {
    name: string;
    displayName: string;
    inputTokenLimit?: number;
}

interface GeminiModelsResponse {
    models?: GeminiModelEntry[];
}

interface ClaudeModelEntry {
    id: string;
    display_name?: string;
    max_input_tokens?: number;
}

interface ClaudeModelsResponse {
    data?: ClaudeModelEntry[];
}

interface OpenAICompatibleModelEntry {
    id: string;
    name?: string;
    context_length?: number;
}

interface OpenAICompatibleModelsResponse {
    data?: OpenAICompatibleModelEntry[];
}

// ── Provider-specific fetchers ──

async function fetchGeminiModels(baseUrl: string, apiKey: string): Promise<AiRemoteModel[]> {
    const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
    if (!res.ok) {
        return [];
    }

    const data = (await res.json()) as GeminiModelsResponse;
    return (data.models ?? [])
        .filter((m) => m.name.startsWith('models/gemini') && isChatModel(m.name))
        .map((m) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName,
            contextWindow: toPositiveInt(m.inputTokenLimit),
        }));
}

async function fetchClaudeModels(baseUrl: string, apiKey: string): Promise<AiRemoteModel[]> {
    const res = await fetch(`${baseUrl}/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) {
        return [];
    }

    const data = (await res.json()) as ClaudeModelsResponse;
    return (data.data ?? [])
        .filter((m) => isChatModel(m.id))
        .map((m) => ({
            id: m.id,
            name: m.display_name ?? m.id,
            contextWindow: toPositiveInt(m.max_input_tokens),
        }));
}

async function fetchOpenAICompatibleModels(
    baseUrl: string,
    apiKey?: string,
): Promise<AiRemoteModel[]> {
    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/models`, { headers });
    if (!res.ok) {
        return [];
    }

    const data = (await res.json()) as OpenAICompatibleModelsResponse;
    return (data.data ?? [])
        .filter((m) => isChatModel(m.id))
        .map((m) => ({
            id: m.id,
            name: m.name ?? m.id,
            contextWindow: toPositiveInt(m.context_length),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

// ── Public API ──

export async function fetchProviderModels(
    settings: AiSettings,
    input: { providerId: string; apiKey?: string; baseUrl?: string },
): Promise<AiRemoteModel[]> {
    const { providerId } = input;
    if (providerId === 'local') {
        return [];
    }

    const { apiKey, baseUrl } = resolveCredentials(settings, providerId, input);
    const base = baseUrl ?? BUILTIN_BASE_URLS[providerId];
    if (!base) {
        return [];
    }

    const isBuiltin = (BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId);
    if (isBuiltin && !apiKey) {
        return [];
    }

    const cache = new SimpleCache<AiRemoteModel[]>(`ai-models:${providerId}`, CACHE_TTL_MS);
    const cached = cache.get();
    if (cached) {
        return cached;
    }

    try {
        let models: AiRemoteModel[];
        if (providerId === 'gemini') {
            models = await fetchGeminiModels(base, apiKey ?? '');
        } else if (providerId === 'claude') {
            models = await fetchClaudeModels(base, apiKey ?? '');
        } else {
            models = await fetchOpenAICompatibleModels(base, apiKey);
        }

        if (models.length > 0) {
            cache.set(models);
        }
        return models;
    } catch (err) {
        log.warn(`Failed to fetch models for provider ${providerId}:`, err);
        return cache.getStale() ?? [];
    }
}

/**
 * Resolve the context window size for a model.
 *
 * Resolution chain:
 * 1. Cached API response (provider returned contextWindow)
 * 2. Static registry (known model prefix match)
 * 3. undefined (caller should use a safe default)
 */
export async function getModelContextWindow(
    providerId: string,
    modelId: string,
): Promise<number | undefined> {
    if (providerId === 'local') {
        return undefined;
    }

    const cache = new SimpleCache<AiRemoteModel[]>(`ai-models:${providerId}`, CACHE_TTL_MS);
    const models = cache.get() ?? cache.getStale();
    const fromApi = models?.find((m) => m.id === modelId)?.contextWindow;
    if (fromApi) {
        return fromApi;
    }

    return lookupContextWindow(modelId);
}
