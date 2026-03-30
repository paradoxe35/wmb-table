/**
 * Model context window resolution via OpenRouter + LiteLLM registries (cached 24h).
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

const QUANT_PATTERN = /[-_](?:q\d[_a-z0-9]*|fp16|fp32|bf16|f16|f32|gguf|iq\d[_a-z0-9]*)$/i;
const PARAM_SIZE_PATTERN = /^(\d+\.?\d*[bm](?:-a\d+[bm])?)/i;

/**
 * Build candidate names ordered most-specific first.
 *
 * `"qwen3.5:9b"`                            → `["qwen3.5-9b", "qwen3.5"]`
 * `"deepseek-coder-v2:16b-lite-instruct-q2_K"` → `["deepseek-coder-v2-16b-lite-instruct", "deepseek-coder-v2-16b", "deepseek-coder-v2"]`
 * `"openai/gpt-5-mini"`                     → `["gpt-5-mini"]`
 */
function buildCandidates(modelId: string): string[] {
    const afterSlash = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
    const lower = afterSlash.toLowerCase();

    if (!lower.includes(':')) {
        return [lower];
    }

    const [base, tag] = lower.split(':', 2);
    if (!tag || tag === 'latest') {
        return [base];
    }

    const cleanTag = tag.replace(QUANT_PATTERN, '').replace(/-$/, '');
    const paramMatch = cleanTag.match(PARAM_SIZE_PATTERN);
    const candidates: string[] = [];

    if (paramMatch) {
        const paramSize = paramMatch[1];
        const rest = cleanTag.slice(paramSize.length).replace(/^-/, '');

        if (rest) {
            candidates.push(`${base}-${paramSize}-${rest}`);
        }
        candidates.push(`${base}-${paramSize}`);
    } else if (cleanTag) {
        candidates.push(`${base}-${cleanTag}`);
    }

    candidates.push(base);
    return candidates;
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

// ── Matching ──

function isMatch(registryBaseName: string, candidate: string): boolean {
    if (registryBaseName === candidate) {
        return true;
    }
    if (registryBaseName.startsWith(candidate)) {
        const nextChar = registryBaseName[candidate.length];
        return nextChar === '-' || nextChar === '.' || nextChar === undefined;
    }
    return false;
}

function findInModels(candidates: string[], models: OpenRouterModel[]): number | undefined {
    for (const candidate of candidates) {
        for (const model of models) {
            if (!model.context_length || model.context_length <= 0) {
                continue;
            }
            if (isMatch(extractBaseName(model.id), candidate)) {
                return model.context_length;
            }
        }
    }
    return undefined;
}

function findInRegistry(candidates: string[], registry: ContextWindowMap): number | undefined {
    for (const candidate of candidates) {
        for (const [key, contextWindow] of Object.entries(registry)) {
            if (isMatch(extractBaseName(key), candidate)) {
                return contextWindow;
            }
        }
    }
    return undefined;
}

// ── Public API ──

export async function lookupContextWindow(modelId: string): Promise<number | undefined> {
    await ensureRegistries();

    const candidates = buildCandidates(modelId);

    const openRouterModels = openRouterCache.get() ?? openRouterCache.getStale();
    if (openRouterModels) {
        const result = findInModels(candidates, openRouterModels);
        if (result) {
            return result;
        }
    }

    const litellmRegistry = litellmCache.get() ?? litellmCache.getStale();
    if (litellmRegistry) {
        return findInRegistry(candidates, litellmRegistry);
    }

    return undefined;
}
