import type { AiCustomProviderConfig } from './ai.types';

export type BaseUrlProblem = 'empty' | 'invalid' | 'scheme';

export type BaseUrlCheck = { ok: true; url: string } | { ok: false; problem: BaseUrlProblem };

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/**
 * Trims a provider base URL, drops trailing slashes and checks it is an http(s) URL.
 * `defaultPath` is appended when the URL has no path (Ollama serves its OpenAI API under `/v1`).
 */
export function normalizeBaseUrl(
    raw: string | undefined,
    options: { defaultPath?: string } = {},
): BaseUrlCheck {
    const input = (raw ?? '').trim();
    if (!input) return { ok: false, problem: 'empty' };
    if (!HAS_SCHEME.test(input)) return { ok: false, problem: 'scheme' };
    const trimmed = input.replace(/\/+$/, '');

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { ok: false, problem: 'invalid' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, problem: 'scheme' };
    }
    if (!parsed.hostname) return { ok: false, problem: 'invalid' };

    const hasPath = parsed.pathname !== '/';
    const url = !hasPath && options.defaultPath ? `${trimmed}${options.defaultPath}` : trimmed;
    return { ok: true, url };
}

export function normalizeApiKey(raw: string | undefined): string | undefined {
    const trimmed = raw?.trim();
    return trimmed ? trimmed : undefined;
}

export function isLocalBaseUrl(url: string | undefined): boolean {
    const check = normalizeBaseUrl(url);
    if (!check.ok) return false;
    return LOCAL_HOSTNAMES.has(new URL(check.url).hostname);
}

/** Trims every field and normalizes the base URL; throws when the base URL is not usable. */
export function normalizeCustomProvider(provider: AiCustomProviderConfig): AiCustomProviderConfig {
    const baseUrl = normalizeBaseUrl(provider.baseUrl);
    if (!baseUrl.ok) {
        throw new Error(
            `Invalid base URL for custom provider "${provider.name}" (${baseUrl.problem}).`,
        );
    }
    return {
        ...provider,
        name: provider.name.trim(),
        baseUrl: baseUrl.url,
        apiKey: normalizeApiKey(provider.apiKey),
        defaultModel: provider.defaultModel.trim(),
        model: provider.model?.trim() || undefined,
    };
}
