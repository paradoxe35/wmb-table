import log from '@main/lib/logger';
import { SimpleCache } from '@main/lib/simple-cache';
import type { AiRemoteModel, AiSettings } from '@shared/ai.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';

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

// ── Provider-specific fetchers ──

async function fetchGeminiModels(baseUrl: string, apiKey: string): Promise<AiRemoteModel[]> {
    const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string; displayName: string }[] };
    return (data.models ?? [])
        .filter((m) => m.name.startsWith('models/gemini'))
        .map((m) => ({ id: m.name.replace('models/', ''), name: m.displayName }));
}

async function fetchClaudeModels(baseUrl: string, apiKey: string): Promise<AiRemoteModel[]> {
    const res = await fetch(`${baseUrl}/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string; display_name?: string }[] };
    return (data.data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
}

async function fetchOpenAICompatibleModels(
    baseUrl: string,
    apiKey?: string,
): Promise<AiRemoteModel[]> {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl}/models`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string; name?: string }[] };
    return (data.data ?? [])
        .map((m) => ({ id: m.id, name: m.name ?? m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

// ── Public API ──

export async function fetchProviderModels(
    settings: AiSettings,
    input: { providerId: string; apiKey?: string; baseUrl?: string },
): Promise<AiRemoteModel[]> {
    const { providerId } = input;
    if (providerId === 'local') return [];

    const { apiKey, baseUrl } = resolveCredentials(settings, providerId, input);
    const base = baseUrl ?? BUILTIN_BASE_URLS[providerId];
    if (!base) return [];

    // Builtin providers always need an API key; custom providers may not (e.g. Ollama)
    const isBuiltin = (BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId);
    if (isBuiltin && !apiKey) return [];

    const cache = new SimpleCache<AiRemoteModel[]>(`ai-models:${providerId}`, CACHE_TTL_MS);
    const cached = cache.get();
    if (cached) return cached;

    try {
        let models: AiRemoteModel[];
        if (providerId === 'gemini') {
            models = await fetchGeminiModels(base, apiKey ?? '');
        } else if (providerId === 'claude') {
            models = await fetchClaudeModels(base, apiKey ?? '');
        } else {
            models = await fetchOpenAICompatibleModels(base, apiKey);
        }

        if (models.length > 0) cache.set(models);
        return models;
    } catch (err) {
        log.warn(`Failed to fetch models for provider ${providerId}:`, err);
        return cache.getStale() ?? [];
    }
}
