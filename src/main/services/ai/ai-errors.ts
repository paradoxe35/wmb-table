import { APICallError, LoadAPIKeyError, NoSuchModelError, RetryError } from 'ai';
import { InvalidArgumentError, InvalidPromptError } from '@ai-sdk/provider';
import type { AiErrorCode } from '@shared/ai.types';
import { AiTimeoutError, isTimeoutReason } from './model-timeouts';

export interface ClassifiedAiError {
    code: AiErrorCode;
    retryable: boolean;
    /** Short technical text for logs and a "details" line; never shown as the main message. */
    detail: string;
}

const MAX_DETAIL_CHARS = 300;
const MAX_CAUSE_DEPTH = 5;

const CONTEXT_TOO_LONG =
    /context[_ ]length|context window|maximum context|prompt is too long|too many tokens|input is too long|reduce the length|token limit/i;
const QUOTA = /quota|billing|insufficient|credit|payment|plan and/i;
const OVERLOADED = /overloaded/i;
const NETWORK =
    /fetch failed|failed to fetch|cannot connect to api|terminated|socket hang up|other side closed|network|ECONN\w+|ENOTFOUND|EAI_AGAIN|EPIPE|ETIMEDOUT|UND_ERR_\w+/i;

const SECRET_PATTERNS: RegExp[] = [
    /\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g,
    /\bAIza[0-9A-Za-z_-]{10,}/g,
    /\bBearer\s+[^\s"',]+/gi,
    /((?:api[_-]?key|x-api-key|access[_-]?token|authorization)["']?\s*[:=]\s*["']?)[^\s"',&]+/gi,
    /\b[A-Za-z0-9_-]{32,}\b/g,
];

export function scrubSecrets(text: string): string {
    const withoutQueries = text.replace(/(https?:\/\/[^\s?#"'`]+)[?#][^\s"'`]*/g, '$1');
    return SECRET_PATTERNS.reduce(
        (scrubbed, pattern) =>
            scrubbed.replace(pattern, (match, prefix?: string) =>
                typeof prefix === 'string' && match.startsWith(prefix)
                    ? `${prefix}[redacted]`
                    : '[redacted]',
            ),
        withoutQueries,
    );
}

function messageOf(error: unknown): string {
    if (error instanceof Error || error instanceof DOMException) return error.message;
    return typeof error === 'string' ? error : '';
}

function codeOf(error: unknown): string {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : '';
}

/** The runner and the SDK wrap provider errors; the most specific one is the deepest. */
function errorChain(error: unknown): unknown[] {
    const chain: unknown[] = [];
    let current: unknown = error;
    while (current != null && chain.length < MAX_CAUSE_DEPTH) {
        chain.push(current);
        current = RetryError.isInstance(current)
            ? current.lastError
            : (current as { cause?: unknown }).cause;
    }
    return chain;
}

function classifyStatus(status: number, message: string): Omit<ClassifiedAiError, 'detail'> {
    if (status === 401 || status === 403) return { code: 'auth', retryable: false };
    if (status === 404) return { code: 'model-not-found', retryable: false };
    if (status === 402) return { code: 'quota', retryable: false };
    if (status === 429) {
        return QUOTA.test(message)
            ? { code: 'quota', retryable: false }
            : { code: 'rate-limit', retryable: true };
    }
    if (status === 408) return { code: 'timeout', retryable: true };
    if (status === 413 || CONTEXT_TOO_LONG.test(message)) {
        return { code: 'context-too-long', retryable: false };
    }
    if (status >= 500) return { code: 'provider-unavailable', retryable: true };
    return { code: 'invalid-request', retryable: false };
}

function classifyOne(error: unknown): Omit<ClassifiedAiError, 'detail'> | null {
    const message = messageOf(error);
    if (error instanceof AiTimeoutError) return { code: 'timeout', retryable: true };
    if (APICallError.isInstance(error)) {
        if (error.statusCode != null) return classifyStatus(error.statusCode, message);
        return { code: 'network', retryable: true };
    }
    if (LoadAPIKeyError.isInstance(error)) return { code: 'not-configured', retryable: false };
    if (NoSuchModelError.isInstance(error)) return { code: 'model-not-found', retryable: false };
    if (InvalidPromptError.isInstance(error) || InvalidArgumentError.isInstance(error)) {
        return { code: 'invalid-request', retryable: false };
    }
    if (CONTEXT_TOO_LONG.test(message)) return { code: 'context-too-long', retryable: false };
    if (OVERLOADED.test(message)) return { code: 'provider-unavailable', retryable: true };
    if (NETWORK.test(message) || NETWORK.test(codeOf(error))) {
        return { code: 'network', retryable: true };
    }
    if (isTimeoutReason(error)) return { code: 'timeout', retryable: true };
    return null;
}

function describeError(error: unknown): string {
    if (error instanceof AiTimeoutError) return `Model timeout (${error.kind})`;
    const message = messageOf(error) || String(error ?? 'Unknown error');
    const status = APICallError.isInstance(error) ? error.statusCode : undefined;
    return status != null ? `HTTP ${status}: ${message}` : message;
}

function repeatsItsCause(error: unknown): boolean {
    const cause = (error as { cause?: unknown } | null)?.cause;
    return cause != null && messageOf(error) === messageOf(cause);
}

/** "terminated: other side closed"; a wrapper that repeats its cause's text adds nothing. */
function describeChain(chain: unknown[]): string {
    const parts: string[] = [];
    for (const error of chain) {
        if (RetryError.isInstance(error) || repeatsItsCause(error)) continue;
        const text = describeError(error);
        if (!text || parts.some((part) => part.includes(text))) continue;
        const kept = parts.filter((part) => !text.includes(part));
        parts.splice(0, parts.length, ...kept, text);
    }
    return parts.join(': ');
}

export function classifyAiError(error: unknown): ClassifiedAiError {
    const chain = errorChain(error);
    const detail = scrubSecrets(describeChain(chain)).slice(0, MAX_DETAIL_CHARS);
    for (const candidate of [...chain].reverse()) {
        const classified = classifyOne(candidate);
        if (classified) return { ...classified, detail };
    }
    return { code: 'unknown', retryable: true, detail };
}

const REASONING_PARAMETER = /reasoning|thinking/i;

/** A model without reasoning support answers 400 and names the setting it cannot take. */
export function isReasoningRejection(error: unknown): boolean {
    return errorChain(error).some(
        (candidate) =>
            APICallError.isInstance(candidate) &&
            candidate.statusCode === 400 &&
            REASONING_PARAMETER.test(`${candidate.message} ${candidate.responseBody ?? ''}`),
    );
}
