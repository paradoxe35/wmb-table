import { SimpleCache } from '@main/lib/simple-cache';

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

export function buildProviderModelsListCacheKey(providerId: string, baseUrl: string): string {
    const suffix = normalizeBaseUrl(baseUrl);
    return `ai-models:${providerId}:${encodeURIComponent(suffix)}`;
}

function buildModelContextCacheKey(modelId: string): string {
    return `ai-model-context:${encodeURIComponent(modelId)}`;
}

function toPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 ? Math.floor(value) : undefined;
}

export function getCachedContextWindow(modelId: string): number | undefined {
    const cache = new SimpleCache<number>(buildModelContextCacheKey(modelId));
    return toPositiveInt(cache.get() ?? cache.getStale());
}

export function cacheContextWindow(modelId: string, contextWindow: number | undefined): void {
    const normalized = toPositiveInt(contextWindow);
    if (!normalized) {
        return;
    }

    const cache = new SimpleCache<number>(buildModelContextCacheKey(modelId));
    cache.set(normalized);
}

export function cacheResolvedContextWindows(
    models: Array<{ id: string; contextWindow?: number }>,
): void {
    for (const model of models) {
        cacheContextWindow(model.id, model.contextWindow);
    }
}
