import { describe, expect, it } from 'vitest';
import { APICallError, LoadAPIKeyError, NoSuchModelError, RetryError } from 'ai';
import { InvalidPromptError } from '@ai-sdk/provider';
import { classifyAiError, scrubSecrets } from '@main/services/ai/ai-errors';
import { AiTimeoutError } from '@main/services/ai/model-timeouts';
import { apiError } from '../../../../helpers/mock-model';

function networkError(message: string, code: string): Error {
    return Object.assign(new Error(message), { code });
}

function retryError(...errors: unknown[]): RetryError {
    return new RetryError({
        message: `Failed after ${errors.length} attempts. Last error: boom`,
        reason: 'maxRetriesExceeded',
        errors,
    });
}

describe('classifyAiError', () => {
    it.each([
        ['401', apiError(401, 'Incorrect API key provided.'), 'auth', false],
        ['403', apiError(403, 'Forbidden'), 'auth', false],
        ['404', apiError(404, 'The model `x` does not exist.'), 'model-not-found', false],
        ['429 rate limit', apiError(429, 'Rate limit reached for requests'), 'rate-limit', true],
        [
            '429 quota',
            apiError(
                429,
                'You exceeded your current quota, please check your plan and billing details.',
            ),
            'quota',
            false,
        ],
        ['402', apiError(402, 'Payment required'), 'quota', false],
        ['413', apiError(413, 'Request too large'), 'context-too-long', false],
        [
            '400 context length',
            apiError(400, "This model's maximum context length is 128000 tokens."),
            'context-too-long',
            false,
        ],
        [
            '400 prompt too long',
            apiError(400, 'prompt is too long: 250000 tokens > 200000 maximum'),
            'context-too-long',
            false,
        ],
        ['400', apiError(400, 'Invalid value for temperature'), 'invalid-request', false],
        ['422', apiError(422, 'Unprocessable'), 'invalid-request', false],
        ['408', apiError(408, 'Request timeout'), 'timeout', true],
        ['500', apiError(500, 'The server had an error.'), 'provider-unavailable', true],
        ['503', apiError(503, 'Service unavailable'), 'provider-unavailable', true],
        ['529 overloaded', apiError(529, 'Overloaded'), 'provider-unavailable', true],
    ])('maps HTTP %s', (_label, error, code, retryable) => {
        expect(classifyAiError(error)).toMatchObject({ code, retryable });
    });

    it('uses the last attempt of a retry error', () => {
        const result = classifyAiError(
            retryError(apiError(500, 'a'), apiError(503, 'Upstream down')),
        );

        expect(result).toMatchObject({ code: 'provider-unavailable', retryable: true });
        expect(result.detail).toContain('Upstream down');
        expect(result.detail).not.toContain('Failed after');
    });

    it('keeps the rate limit of a retried 429', () => {
        expect(classifyAiError(retryError(apiError(429, 'slow down'))).code).toBe('rate-limit');
    });

    it('reads the cause of an error the runner re-wrapped', () => {
        const wrapped = new Error('Unauthorized', { cause: apiError(401, 'Unauthorized') });

        expect(classifyAiError(wrapped)).toMatchObject({ code: 'auth', retryable: false });
    });

    it.each([
        [
            'a connection failure without status',
            new APICallError({
                message: 'Cannot connect to API: getaddrinfo ENOTFOUND api.example.com',
                url: 'https://api.example.com/v1/chat/completions',
                requestBodyValues: {},
                isRetryable: true,
            }),
        ],
        [
            'fetch failed',
            new TypeError('fetch failed', {
                cause: networkError('connect ECONNREFUSED', 'ECONNREFUSED'),
            }),
        ],
        ['ECONNRESET', networkError('read ECONNRESET', 'ECONNRESET')],
        [
            'a dropped stream',
            new TypeError('terminated', {
                cause: networkError('other side closed', 'UND_ERR_SOCKET'),
            }),
        ],
        ['socket hang up', new Error('socket hang up')],
        ['a DNS failure', networkError('getaddrinfo EAI_AGAIN api.example.com', 'EAI_AGAIN')],
    ])('maps %s to network', (_label, error) => {
        expect(classifyAiError(error)).toMatchObject({ code: 'network', retryable: true });
    });

    it.each([
        ['the app timeout', new AiTimeoutError('first-chunk')],
        ['an SDK timeout', new DOMException('The operation timed out.', 'TimeoutError')],
    ])('maps %s to timeout', (_label, error) => {
        expect(classifyAiError(error)).toMatchObject({ code: 'timeout', retryable: true });
    });

    it('does not send the French timeout text as the detail', () => {
        expect(classifyAiError(new AiTimeoutError('chunk')).detail).not.toMatch(/modèle/);
    });

    it.each([
        [
            'a missing key',
            new LoadAPIKeyError({ message: 'API key is missing.' }),
            'not-configured',
            false,
        ],
        [
            'an unknown model',
            new NoSuchModelError({ modelId: 'x', modelType: 'languageModel' }),
            'model-not-found',
            false,
        ],
        [
            'an invalid prompt',
            new InvalidPromptError({ prompt: '', message: 'messages must not be empty' }),
            'invalid-request',
            false,
        ],
        [
            'a stray abort',
            new DOMException('This operation was aborted', 'AbortError'),
            'unknown',
            true,
        ],
        ['anything else', new Error('Something odd'), 'unknown', true],
        ['a thrown string', 'boom', 'unknown', true],
    ])('maps %s', (_label, error, code, retryable) => {
        expect(classifyAiError(error)).toMatchObject({ code, retryable });
    });

    it('gives the status and message as a short detail', () => {
        const result = classifyAiError(apiError(404, 'The model `x` does not exist.'));

        expect(result.detail).toBe('HTTP 404: The model `x` does not exist.');
    });

    it('caps a very long detail', () => {
        expect(classifyAiError(new Error('x'.repeat(5_000))).detail.length).toBeLessThanOrEqual(
            300,
        );
    });
});

describe('scrubSecrets', () => {
    it.each([
        [
            'an OpenAI key',
            'Incorrect API key provided: sk-proj-AbCdEf0123456789abcdef0123.',
            'AbCdEf0123',
        ],
        ['an Anthropic key', 'invalid x-api-key sk-ant-api03-AbCdEf0123456789-xyz', 'AbCdEf0123'],
        ['a Google key', 'API key not valid: AIzaSyAbCdEf0123456789abcdefGHIJ', 'AbCdEf0123'],
        ['a bearer token', 'Authorization: Bearer abc.def-ghi_jkl', 'abc.def'],
        ['a key parameter', 'see https://x.example/v1?key=secret123&alt=sse', 'secret123'],
        ['an api_key field', '{"api_key": "plain-secret-value"}', 'plain-secret'],
        ['a long token', 'token 0123456789abcdef0123456789abcdef0123 rejected', '0123456789abcdef'],
    ])('removes %s', (_label, text, secret) => {
        expect(scrubSecrets(text)).not.toContain(secret);
    });

    it('drops the query of a URL but keeps where it went', () => {
        const scrubbed = scrubSecrets(
            'Cannot reach https://generativelanguage.googleapis.com/v1beta/models/m:stream?alt=sse&key=AIza123',
        );

        expect(scrubbed).toContain(
            'https://generativelanguage.googleapis.com/v1beta/models/m:stream',
        );
        expect(scrubbed).not.toContain('alt=sse');
    });

    it('keeps ordinary text, accents and model names', () => {
        const text = "Le modèle `gpt-4.1-mini` n'existe pas (l'amour, Saint-Esprit).";

        expect(scrubSecrets(text)).toBe(text);
    });
});
