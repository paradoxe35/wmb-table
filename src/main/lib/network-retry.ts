import log from 'electron-log';
import pRetryModule from 'p-retry';
import isNetworkErrorModule from 'is-network-error';
import { resolveDefaultExport } from '@main/lib/module-interop';

const pRetry = resolveDefaultExport(pRetryModule);
const isNetworkError = resolveDefaultExport(isNetworkErrorModule);

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MIN_TIMEOUT_MS = 750;

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_SYSCALL_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'EHOSTUNREACH',
    'ENETDOWN',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_SOCKET',
]);

export interface RetryOptions {
    label: string;
    /** Attempts after the first one. */
    retries?: number;
    minTimeoutMs?: number;
    maxTimeoutMs?: number;
    /** Overall wall-clock ceiling, useful when `retries` is unbounded. */
    maxRetryTimeMs?: number;
    /** Per-request timeout, `fetchWithRetry` only. */
    timeoutMs?: number;
    /**
     * Off for requests that create something: a 5xx means the server saw the call, so
     * replaying it can duplicate the resource. Transport failures are still retried.
     */
    retryOnStatus?: boolean;
    /** Evaluated before each retry, to stop early once the work became obsolete. */
    shouldContinue?: () => boolean;
    signal?: AbortSignal;
}

/** Carries the HTTP status so retry decisions do not have to parse messages. */
export class HttpStatusError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'HttpStatusError';
    }
}

/** Marks a failure the caller already knows is transient, e.g. a truncated download. */
export class RetryableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RetryableError';
    }
}

export function isRetryableStatus(status: number): boolean {
    return RETRYABLE_STATUS_CODES.has(status);
}

/** Node reports the real cause one or more levels down, so the whole chain is checked. */
function hasRetryableSyscall(error: unknown): boolean {
    for (let current = error, depth = 0; current && depth < 5; depth++) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string' && RETRYABLE_SYSCALL_CODES.has(code)) return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

export function isRetryableError(error: unknown): boolean {
    if (error instanceof RetryableError) return true;
    if (error instanceof HttpStatusError) return isRetryableStatus(error.status);
    if (isNetworkError(error)) return true;
    if (hasRetryableSyscall(error)) return true;

    // A deliberate abort is a decision, not a glitch; a timeout is worth another try.
    return error instanceof Error && error.name === 'TimeoutError';
}

export async function retryNetworkCall<T>(
    fn: (attempt: number) => Promise<T>,
    options: RetryOptions,
): Promise<T> {
    return pRetry(fn, {
        retries: options.retries ?? DEFAULT_RETRIES,
        minTimeout: options.minTimeoutMs ?? DEFAULT_MIN_TIMEOUT_MS,
        maxTimeout: options.maxTimeoutMs ?? Number.POSITIVE_INFINITY,
        maxRetryTime: options.maxRetryTimeMs ?? Number.POSITIVE_INFINITY,
        // Prefetching fans out, so identical backoffs would retry in lockstep.
        randomize: true,
        signal: options.signal,
        shouldRetry: ({ error }) => (options.shouldContinue?.() ?? true) && isRetryableError(error),
        onFailedAttempt: ({ error, retryDelay }) => {
            if (retryDelay > 0 && isRetryableError(error)) {
                log.warn(`${options.label} failed, retrying in ${retryDelay}ms`, error);
            }
        },
    });
}

interface FailedResponse {
    body: string;
    status: number;
    statusText: string;
    headers: Headers;
}

export async function fetchWithRetry(
    input: string | URL | Request,
    init: RequestInit,
    options: RetryOptions,
): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retryOnStatus = options.retryOnStatus ?? true;
    // A holder, not a plain binding: assignment happens in a closure the compiler cannot follow.
    const lastFailure: { value: FailedResponse | null } = { value: null };

    try {
        return await retryNetworkCall(async () => {
            const timeout = AbortSignal.timeout(timeoutMs);
            const response = await fetch(input, {
                ...init,
                signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
            });

            if (!retryOnStatus || !isRetryableStatus(response.status)) return response;

            // Drained now, replayed below: callers read the body for their error message.
            lastFailure.value = {
                body: await response.text().catch(() => ''),
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            };
            throw new HttpStatusError(
                response.status,
                `${options.label} returned ${response.status}`,
            );
        }, options);
    } catch (error) {
        const failure = lastFailure.value;
        if (error instanceof HttpStatusError && failure) {
            return new Response(failure.body, {
                status: failure.status,
                statusText: failure.statusText,
                headers: failure.headers,
            });
        }
        throw error;
    }
}
