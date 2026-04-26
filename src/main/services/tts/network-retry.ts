import log from 'electron-log';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_BASE_DELAY_MS = 750;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface TtsRetryOptions {
    label: string;
    maxAttempts?: number;
    timeoutMs?: number;
    baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDelayMs(attempt: number, baseDelayMs: number): number {
    return baseDelayMs * 2 ** attempt;
}

function isRetryableError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
        return true;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            error.name === 'AbortError' ||
            error.name === 'TimeoutError' ||
            message.includes('timeout') ||
            message.includes('network') ||
            message.includes('socket') ||
            message.includes('econnreset') ||
            message.includes('etimedout') ||
            message.includes('fetch failed')
        );
    }

    return false;
}

export async function retryTtsNetworkCall<T>(
    fn: (attempt: number) => Promise<T>,
    options: TtsRetryOptions,
): Promise<T> {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;
            if (attempt >= maxAttempts - 1 || !isRetryableError(error)) {
                throw error;
            }

            const delayMs = getDelayMs(attempt, baseDelayMs);
            log.warn(`${options.label} failed, retrying in ${delayMs}ms`, error);
            await sleep(delayMs);
        }
    }

    throw lastError;
}

export async function fetchTtsWithRetry(
    input: string | URL | Request,
    init: RequestInit,
    options: TtsRetryOptions,
): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(input, {
                ...init,
                signal: AbortSignal.timeout(timeoutMs),
            });

            if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= maxAttempts - 1) {
                return response;
            }

            lastResponse = response;
            await response.arrayBuffer().catch(() => undefined);
            const delayMs = getDelayMs(attempt, baseDelayMs);
            log.warn(`${options.label} returned ${response.status}, retrying in ${delayMs}ms`);
            await sleep(delayMs);
        } catch (error) {
            if (attempt >= maxAttempts - 1 || !isRetryableError(error)) {
                throw error;
            }

            const delayMs = getDelayMs(attempt, baseDelayMs);
            log.warn(`${options.label} failed, retrying in ${delayMs}ms`, error);
            await sleep(delayMs);
        }
    }

    if (lastResponse) {
        return lastResponse;
    }

    throw new Error(`${options.label} failed.`);
}
