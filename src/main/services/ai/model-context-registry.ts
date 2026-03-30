/**
 * Model context window resolution.
 *
 * Resolves context window sizes from two remote registries (cached 24h):
 * 1. OpenRouter — 300+ models, public, no API key needed
 * 2. LiteLLM — 1000+ models, raw JSON on GitHub
 */

import log from '@main/lib/logger';
import { SimpleCache } from '@main/lib/simple-cache';

// ── Configuration ──

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const LITELLM_REGISTRY_URL =
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const CHAT_MODES = new Set<string | undefined>(['chat', 'completion', undefined]);

// ── Types ──

interface OpenRouterModel {
    id: string;
    context_length?: number;
}

interface LiteLLMRawEntry {
    max_input_tokens?: number;
    max_tokens?: number;
    mode?: string;
}

type ContextWindowMap = Record<string, number>;

// ── Caches ──

const openRouterCache = new SimpleCache<OpenRouterModel[]>('ctx-registry:openrouter', CACHE_TTL_MS);
const litellmCache = new SimpleCache<ContextWindowMap>('ctx-registry:litellm', CACHE_TTL_MS);

// ── Normalization ──

function normalizeModelId(modelId: string): string {
    const afterSlash = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
    const beforeColon = afterSlash.includes(':') ? afterSlash.split(':')[0] : afterSlash;
    return beforeColon.toLowerCase();
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

async function fetchLiteLLMRegistry(): Promise<ContextWindowMap> {
    const response = await fetchWithTimeout(LITELLM_REGISTRY_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const raw = (await response.json()) as Record<string, LiteLLMRawEntry>;
    const result: ContextWindowMap = {};

    for (const [key, entry] of Object.entries(raw)) {
        if (!CHAT_MODES.has(entry.mode)) {
            continue;
        }
        const tokens = entry.max_input_tokens ?? entry.max_tokens;
        if (typeof tokens === 'number' && tokens > 0) {
            result[key] = tokens;
        }
    }

    return result;
}

// ── Ensure registries are loaded ──

async function ensureRegistries(): Promise<void> {
    const logError = (source: string) => (err: unknown) => {
        log.warn(`Context registry fetch failed: ${source}`, {
            error: err instanceof Error ? err.message : String(err),
        });
    };

    await Promise.all([
        openRouterCache.getOrFetch(fetchOpenRouterModels).catch(logError('OpenRouter')),
        litellmCache.getOrFetch(fetchLiteLLMRegistry).catch(logError('LiteLLM')),
    ]);
}

// ── Lookup ──

function lookupOpenRouter(normalized: string): number | undefined {
    const models = openRouterCache.get() ?? openRouterCache.getStale();
    if (!models) {
        return undefined;
    }

    const variants = [normalized, `${normalized}-instruct`, `${normalized}-thinking`];

    for (const model of models) {
        if (!model.context_length || model.context_length <= 0) {
            continue;
        }
        if (variants.includes(extractBaseName(model.id))) {
            return model.context_length;
        }
    }

    return undefined;
}

function lookupLiteLLM(normalized: string): number | undefined {
    const registry = litellmCache.get() ?? litellmCache.getStale();
    if (!registry) {
        return undefined;
    }

    for (const [key, contextWindow] of Object.entries(registry)) {
        if (extractBaseName(key) === normalized) {
            return contextWindow;
        }
    }

    return undefined;
}

// ── Public API ──

export async function lookupContextWindow(modelId: string): Promise<number | undefined> {
    await ensureRegistries();
    const normalized = normalizeModelId(modelId);
    return lookupOpenRouter(normalized) ?? lookupLiteLLM(normalized);
}
