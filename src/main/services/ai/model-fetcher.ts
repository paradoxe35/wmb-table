import log from '@main/lib/logger';
import { SimpleCache } from '@main/lib/simple-cache';
import type { AiRemoteModel, AiSettings } from '@shared/ai.types';
import {
    BUILTIN_PROVIDER_IDS,
    BUILTIN_PROVIDER_REQUIRES_API_KEY,
    resolveProviderApiKey,
    resolveProviderBaseUrl,
} from '@shared/ai.types';
import {
    buildProviderModelsListCacheKey,
    buildModelLimitCacheScope,
    cacheContextWindow,
    cacheMaxOutputTokens,
    cacheResolvedModelLimits,
    getCachedMaxOutputTokens,
    getCachedContextWindow,
} from './model-context-cache';
import { lookupModelLimits, type ModelLimits } from './model-context-registry';

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ── Credential resolution ──

interface ResolvedCredentials {
    apiKey: string | undefined;
    baseUrl: string | undefined;
}

function normalizeBaseUrl(baseUrl?: string): string | undefined {
    const normalized = baseUrl?.trim().replace(/\/+$/, '');
    return normalized || undefined;
}

function resolveCredentials(
    settings: AiSettings,
    providerId: string,
    input: { apiKey?: string; baseUrl?: string },
): ResolvedCredentials {
    return {
        apiKey: input.apiKey ?? resolveProviderApiKey(settings, providerId),
        baseUrl: input.baseUrl ?? resolveProviderBaseUrl(settings, providerId),
    };
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
    top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
    };
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
            contextWindow: toPositiveInt(m.context_length ?? m.top_provider?.context_length),
            maxOutputTokens: toPositiveInt(m.top_provider?.max_completion_tokens),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function getCachedProviderModels(
    providerId: string,
    baseUrl: string | undefined,
): AiRemoteModel[] | undefined {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
        return undefined;
    }

    const cache = new SimpleCache<AiRemoteModel[]>(
        buildProviderModelsListCacheKey(providerId, normalizedBaseUrl),
        CACHE_TTL_MS,
    );
    return cache.get() ?? cache.getStale() ?? undefined;
}

function getModelLimitCacheScope(providerId: string, baseUrl?: string): string {
    return buildModelLimitCacheScope(providerId, normalizeBaseUrl(baseUrl));
}

function applyModelLimits(
    target: ModelLimits,
    modelId: string,
    limits: ModelLimits | undefined,
    scope: string,
) {
    if (limits?.contextWindow && limits.contextWindow > 0) {
        target.contextWindow ??= limits.contextWindow;
        cacheContextWindow(modelId, limits.contextWindow, scope);
    }
    if (limits?.maxOutputTokens && limits.maxOutputTokens > 0) {
        target.maxOutputTokens ??= limits.maxOutputTokens;
        cacheMaxOutputTokens(modelId, limits.maxOutputTokens, scope);
    }
}

// ── Public API ──

export async function fetchProviderModels(
    settings: AiSettings,
    input: { providerId: string; apiKey?: string; baseUrl?: string },
): Promise<AiRemoteModel[]> {
    const { providerId } = input;
    const { apiKey, baseUrl } = resolveCredentials(settings, providerId, input);
    const base = normalizeBaseUrl(baseUrl);
    if (!base) {
        return [];
    }

    const isBuiltin = (BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId);
    if (
        isBuiltin &&
        BUILTIN_PROVIDER_REQUIRES_API_KEY[
            providerId as keyof typeof BUILTIN_PROVIDER_REQUIRES_API_KEY
        ] &&
        !apiKey
    ) {
        return [];
    }

    const cache = new SimpleCache<AiRemoteModel[]>(
        buildProviderModelsListCacheKey(providerId, base),
        CACHE_TTL_MS,
    );

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
            cacheResolvedModelLimits(models, getModelLimitCacheScope(providerId, base));
        }
        return models;
    } catch (err) {
        log.warn(`Failed to fetch models for provider ${providerId}:`, err);
        return cache.getStale() ?? [];
    }
}

/**
 * Resolve known limits for a model.
 *
 * Resolution chain:
 * 1. Cached API response (provider returned limits)
 * 2. External registries (OpenRouter + models.dev)
 * 3. undefined values (caller should use safe defaults)
 */
export async function getModelLimits(
    providerId: string,
    modelId: string,
    baseUrl?: string,
): Promise<ModelLimits> {
    const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
    const cacheScope = getModelLimitCacheScope(providerId, resolvedBaseUrl);
    const limits: ModelLimits = {
        contextWindow: getCachedContextWindow(modelId, cacheScope),
        maxOutputTokens: getCachedMaxOutputTokens(modelId, cacheScope),
    };

    if (limits.contextWindow && limits.maxOutputTokens) {
        return limits;
    }

    const cachedModels = getCachedProviderModels(providerId, resolvedBaseUrl);
    const fromApi = cachedModels?.find((m) => m.id === modelId);
    applyModelLimits(limits, modelId, fromApi, cacheScope);

    if (limits.contextWindow && limits.maxOutputTokens) {
        return limits;
    }

    applyModelLimits(limits, modelId, await lookupModelLimits(modelId, providerId), cacheScope);

    return limits;
}

export async function getModelContextWindow(
    providerId: string,
    modelId: string,
    baseUrl?: string,
): Promise<number | undefined> {
    const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
    const cacheScope = getModelLimitCacheScope(providerId, resolvedBaseUrl);
    const cachedContextWindow = getCachedContextWindow(modelId, cacheScope);
    if (cachedContextWindow) {
        return cachedContextWindow;
    }

    const cachedModels = getCachedProviderModels(providerId, resolvedBaseUrl);
    const fromApi = cachedModels?.find((m) => m.id === modelId)?.contextWindow;
    if (fromApi && fromApi > 0) {
        cacheContextWindow(modelId, fromApi, cacheScope);
        return fromApi;
    }

    const fromRegistry = await lookupModelLimits(modelId, providerId);
    if (fromRegistry?.contextWindow) {
        cacheContextWindow(modelId, fromRegistry.contextWindow, cacheScope);
    }
    return fromRegistry?.contextWindow;
}
