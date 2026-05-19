import { SimpleCache } from '@main/lib/simple-cache';

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

export function buildProviderModelsListCacheKey(providerId: string, baseUrl: string): string {
    const suffix = normalizeBaseUrl(baseUrl);
    return `ai-models:${providerId}:${encodeURIComponent(suffix)}`;
}

export function buildModelLimitCacheScope(providerId: string, baseUrl?: string): string {
    const normalizedBaseUrl = baseUrl ? normalizeBaseUrl(baseUrl) : '';
    return normalizedBaseUrl ? `${providerId}:${normalizedBaseUrl}` : providerId;
}

function buildScopedModelLimitCacheKey(prefix: string, modelId: string, scope?: string): string {
    return scope
        ? `${prefix}:${encodeURIComponent(scope)}:${encodeURIComponent(modelId)}`
        : `${prefix}:${encodeURIComponent(modelId)}`;
}

function buildModelContextCacheKey(modelId: string, scope?: string): string {
    return buildScopedModelLimitCacheKey('ai-model-context', modelId, scope);
}

function buildModelOutputCacheKey(modelId: string, scope?: string): string {
    return buildScopedModelLimitCacheKey('ai-model-output', modelId, scope);
}

function toPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 ? Math.floor(value) : undefined;
}

export function getCachedContextWindow(modelId: string, scope?: string): number | undefined {
    const cache = new SimpleCache<number>(buildModelContextCacheKey(modelId, scope));
    return toPositiveInt(cache.get() ?? cache.getStale());
}

export function cacheContextWindow(
    modelId: string,
    contextWindow: number | undefined,
    scope?: string,
): void {
    const normalized = toPositiveInt(contextWindow);
    if (!normalized) {
        return;
    }

    const cache = new SimpleCache<number>(buildModelContextCacheKey(modelId, scope));
    cache.set(normalized);
}

export function getCachedMaxOutputTokens(modelId: string, scope?: string): number | undefined {
    const cache = new SimpleCache<number>(buildModelOutputCacheKey(modelId, scope));
    return toPositiveInt(cache.get() ?? cache.getStale());
}

export function cacheMaxOutputTokens(
    modelId: string,
    maxOutputTokens: number | undefined,
    scope?: string,
): void {
    const normalized = toPositiveInt(maxOutputTokens);
    if (!normalized) {
        return;
    }

    const cache = new SimpleCache<number>(buildModelOutputCacheKey(modelId, scope));
    cache.set(normalized);
}

export function cacheResolvedModelLimits(
    models: Array<{ id: string; contextWindow?: number; maxOutputTokens?: number }>,
    scope?: string,
): void {
    for (const model of models) {
        cacheContextWindow(model.id, model.contextWindow, scope);
        cacheMaxOutputTokens(model.id, model.maxOutputTokens, scope);
    }
}
