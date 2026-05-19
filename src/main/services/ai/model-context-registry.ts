/**
 * Model limit resolution via OpenRouter + models.dev registries (cached 24h).
 */

import log from '@main/lib/logger';
import { SimpleCache } from '@main/lib/simple-cache';

// ── Configuration ──

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const MODELS_DEV_REGISTRY_URL = 'https://models.dev/api.json';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

// ── Types ──

interface OpenRouterModel {
    id: string;
    context_length?: number;
    top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
    };
}

interface ModelsDevModel {
    id: string;
    limit?: {
        context?: number;
        output?: number;
    };
}

interface ModelsDevProvider {
    id: string;
    models?: Record<string, ModelsDevModel>;
}

export interface ModelLimits {
    contextWindow?: number;
    maxOutputTokens?: number;
}

type ModelLimitMap = Record<string, ModelLimits>;

// ── Caches ──

const openRouterCache = new SimpleCache<OpenRouterModel[]>('ctx-registry:openrouter', CACHE_TTL_MS);
const modelsDevCache = new SimpleCache<ModelLimitMap>('ctx-registry:models-dev', CACHE_TTL_MS);

// ── Normalization ──

const QUANT_PATTERN = /[-_](?:q\d[_a-z0-9]*|fp16|fp32|bf16|f16|f32|gguf|iq\d[_a-z0-9]*)$/i;
const PARAM_SIZE_PATTERN = /^(\d+\.?\d*[bm](?:-a\d+[bm])?)/i;
const PROVIDER_ALIASES: Record<string, string[]> = {
    claude: ['anthropic'],
    gemini: ['google'],
    openai: ['openai'],
    openrouter: ['openrouter'],
};

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function buildBaseVariants(base: string): string[] {
    const normalizedLetterVersion = base.replace(/([a-z])(?=\d)/gi, '$1-');
    const compactLetterVersion = base.replace(/([a-z])-(?=\d)/gi, '$1');
    const initial = unique([base, normalizedLetterVersion, compactLetterVersion]);
    return unique(
        initial.flatMap((variant) => [
            variant,
            variant.replace(/\./g, '-'),
            variant.replace(/(\d)-(?=\d)/g, '$1.'),
        ]),
    );
}

/**
 * Build candidate names ordered most-specific first. Letter/version separator variants are
 * included where useful, e.g. `granite4.1` also tries `granite-4.1`.
 *
 * `"qwen3.5:9b"`                            includes `qwen3.5:9b`, `qwen-3.5:9b`, `qwen-3-5-9b`
 * `"deepseek-coder-v2:16b-lite-instruct-q2_K"` includes `deepseek-coder-v2-16b-lite-instruct`, `deepseek-coder-v2-16b`
 * `"granite4.1:8b"`                         includes `granite4.1-8b`, `granite-4.1-8b`
 * `"openai/gpt-5-mini"`                     includes `gpt-5-mini`
 */
function buildCandidates(modelId: string): string[] {
    const full = modelId.toLowerCase();
    const afterSlash = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
    const lower = afterSlash.toLowerCase();

    if (!lower.includes(':')) {
        const lowerVariants = buildBaseVariants(lower);
        return unique(full === lower ? lowerVariants : [full, ...lowerVariants]);
    }

    const [base, tag] = lower.split(':', 2);
    const tagBaseVariants = buildBaseVariants(base);
    if (!tag || tag === 'latest') {
        return tagBaseVariants;
    }

    const cleanTag = tag.replace(QUANT_PATTERN, '').replace(/-$/, '');
    const paramMatch = cleanTag.match(PARAM_SIZE_PATTERN);
    const candidates: string[] = [];

    if (paramMatch) {
        const paramSize = paramMatch[1];
        const rest = cleanTag.slice(paramSize.length).replace(/^-/, '');

        for (const baseVariant of tagBaseVariants) {
            if (rest) {
                candidates.push(`${baseVariant}:${paramSize}-${rest}`);
                candidates.push(`${baseVariant}-${paramSize}-${rest}`);
            } else {
                candidates.push(`${baseVariant}:${paramSize}`);
            }
            candidates.push(`${baseVariant}-${paramSize}`);
        }
    } else if (cleanTag) {
        for (const baseVariant of tagBaseVariants) {
            candidates.push(`${baseVariant}:${cleanTag}`);
            candidates.push(`${baseVariant}-${cleanTag}`);
        }
    }

    candidates.push(...tagBaseVariants);
    return unique(candidates);
}

function buildProviderCandidates(providerId: string | undefined, modelCandidates: string[]) {
    if (!providerId) {
        return [];
    }

    const aliases = [providerId, ...(PROVIDER_ALIASES[providerId] ?? [])];
    return aliases.flatMap((provider) =>
        modelCandidates.map((candidate) => `${provider}/${candidate}`.toLowerCase()),
    );
}

function extractBaseName(id: string): string {
    const idx = id.lastIndexOf('/');
    return (idx === -1 ? id : id.slice(idx + 1)).toLowerCase();
}

// ── Fetchers ──

async function fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    const response = await fetchWithTimeout(OPENROUTER_MODELS_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as { data?: OpenRouterModel[] };
    return Array.isArray(body?.data) ? body.data : [];
}

function toPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 ? Math.floor(value) : undefined;
}

function addModelLimits(registry: ModelLimitMap, keys: string[], limits: ModelLimits): void {
    for (const key of keys) {
        registry[key.toLowerCase()] = limits;
    }
}

async function fetchModelsDevRegistry(): Promise<ModelLimitMap> {
    const response = await fetchWithTimeout(MODELS_DEV_REGISTRY_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const raw = (await response.json()) as Record<string, ModelsDevProvider>;
    const result: ModelLimitMap = {};

    for (const [providerKey, provider] of Object.entries(raw)) {
        if (!provider?.models) {
            continue;
        }

        for (const [modelKey, model] of Object.entries(provider.models)) {
            const contextWindow = toPositiveInt(model.limit?.context);
            const maxOutputTokens = toPositiveInt(model.limit?.output);
            if (!contextWindow && !maxOutputTokens) {
                continue;
            }

            const limits = { contextWindow, maxOutputTokens };
            addModelLimits(
                result,
                [model.id, modelKey, `${provider.id}/${model.id}`, `${providerKey}/${model.id}`],
                limits,
            );
        }
    }

    return result;
}

async function ensureRegistries(): Promise<void> {
    const logError = (source: string) => (err: unknown) => {
        log.warn(`Model limit registry fetch failed: ${source}`, {
            error: err instanceof Error ? err.message : String(err),
        });
    };

    await Promise.all([
        openRouterCache.getOrFetch(fetchOpenRouterModels).catch(logError('OpenRouter')),
        modelsDevCache.getOrFetch(fetchModelsDevRegistry).catch(logError('models.dev')),
    ]);
}

// ── Matching ──

function isMatch(registryBaseName: string, candidate: string): boolean {
    if (registryBaseName === candidate) {
        return true;
    }
    if (registryBaseName.startsWith(candidate)) {
        const nextChar = registryBaseName[candidate.length];
        return nextChar === '-' || nextChar === '.' || nextChar === ':' || nextChar === undefined;
    }
    return false;
}

function mergeLimits(...limits: Array<ModelLimits | undefined>): ModelLimits | undefined {
    const merged: ModelLimits = {};
    for (const limit of limits) {
        if (!limit) {
            continue;
        }
        merged.contextWindow ??= limit.contextWindow;
        merged.maxOutputTokens ??= limit.maxOutputTokens;
    }
    return merged.contextWindow || merged.maxOutputTokens ? merged : undefined;
}

function openRouterModelLimits(model: OpenRouterModel): ModelLimits | undefined {
    return mergeLimits({
        contextWindow: toPositiveInt(model.context_length ?? model.top_provider?.context_length),
        maxOutputTokens: toPositiveInt(model.top_provider?.max_completion_tokens),
    });
}

function findInModels(
    candidates: string[],
    models: OpenRouterModel[],
    allowPrefixFallback: boolean,
): ModelLimits | undefined {
    for (const candidate of candidates) {
        for (const model of models) {
            const limits = openRouterModelLimits(model);
            if (!limits) {
                continue;
            }
            if (model.id.toLowerCase() === candidate) {
                return limits;
            }
        }
    }

    for (const candidate of candidates) {
        for (const model of models) {
            const limits = openRouterModelLimits(model);
            if (!limits) {
                continue;
            }
            if (extractBaseName(model.id) === candidate) {
                return limits;
            }
        }
    }

    if (allowPrefixFallback) {
        for (const candidate of candidates) {
            for (const model of models) {
                const limits = openRouterModelLimits(model);
                if (!limits) {
                    continue;
                }
                const modelId = model.id.toLowerCase();
                if (candidate.includes('/') && isMatch(modelId, candidate)) {
                    return limits;
                }
                if (!candidate.includes('/') && isMatch(extractBaseName(model.id), candidate)) {
                    return limits;
                }
            }
        }
    }
    return undefined;
}

function findInRegistry(
    candidates: string[],
    registry: ModelLimitMap,
    allowPrefixFallback: boolean,
): ModelLimits | undefined {
    for (const candidate of candidates) {
        const exact = registry[candidate];
        if (exact) {
            return exact;
        }
    }

    for (const candidate of candidates) {
        for (const [key, limits] of Object.entries(registry)) {
            if (extractBaseName(key) === candidate) {
                return limits;
            }
        }
    }

    if (allowPrefixFallback) {
        for (const candidate of candidates) {
            for (const [key, limits] of Object.entries(registry)) {
                if (candidate.includes('/') && isMatch(key.toLowerCase(), candidate)) {
                    return limits;
                }
                if (!candidate.includes('/') && isMatch(extractBaseName(key), candidate)) {
                    return limits;
                }
            }
        }
    }
    return undefined;
}

// ── Public API ──

export async function lookupModelLimits(
    modelId: string,
    providerId?: string,
): Promise<ModelLimits | undefined> {
    await ensureRegistries();

    const modelCandidates = buildCandidates(modelId);
    const providerCandidates = buildProviderCandidates(providerId, modelCandidates);
    const candidates = [...providerCandidates, ...modelCandidates];
    const allowPrefixFallback = modelId.includes(':');
    const matches: ModelLimits[] = [];

    const openRouterModels = openRouterCache.get() ?? openRouterCache.getStale();
    if (openRouterModels) {
        const result = findInModels(candidates, openRouterModels, allowPrefixFallback);
        if (result) {
            matches.push(result);
        }
    }

    const modelsDevRegistry = modelsDevCache.get() ?? modelsDevCache.getStale();
    if (modelsDevRegistry) {
        const result = findInRegistry(candidates, modelsDevRegistry, allowPrefixFallback);
        if (result) {
            matches.push(result);
        }
    }

    return mergeLimits(...matches);
}

export async function lookupContextWindow(modelId: string): Promise<number | undefined> {
    return (await lookupModelLimits(modelId))?.contextWindow;
}
