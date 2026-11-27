const EXTERNAL_URL_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'http:', 'mailto:']);
const MAX_EXTERNAL_URL_LENGTH = 16_384;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Relative URLs are refused on purpose: they resolve against the app page,
 * which is a `file:` URL in production.
 */
export function toSafeExternalUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const candidate = value.trim();
    if (!candidate || candidate.length > MAX_EXTERNAL_URL_LENGTH) return null;
    if (CONTROL_CHARACTERS.test(candidate)) return null;

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return null;
    }

    if (!EXTERNAL_URL_PROTOCOLS.has(url.protocol)) return null;
    if (url.protocol !== 'mailto:' && !url.hostname) return null;

    return url.href;
}
