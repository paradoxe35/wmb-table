import { describe, expect, it } from 'vitest';
import {
    isLocalBaseUrl,
    normalizeApiKey,
    normalizeBaseUrl,
    normalizeCustomProvider,
} from '@shared/ai-provider-input';

describe('normalizeBaseUrl', () => {
    it.each([
        ['  http://127.0.0.1:1234/v1  ', 'http://127.0.0.1:1234/v1'],
        ['http://localhost:11434/v1/', 'http://localhost:11434/v1'],
        ['https://api.example.com/v1///', 'https://api.example.com/v1'],
        ['https://api.example.com', 'https://api.example.com'],
        ['HTTPS://Api.Example.com/v1', 'HTTPS://Api.Example.com/v1'],
        ['\thttp://localhost:11434\n', 'http://localhost:11434'],
    ])('accepts %j as %j', (raw, url) => {
        expect(normalizeBaseUrl(raw)).toEqual({ ok: true, url });
    });

    it.each([
        ['', 'empty'],
        ['   ', 'empty'],
        [undefined, 'empty'],
        ['localhost:11434', 'scheme'],
        ['127.0.0.1:1234/v1', 'scheme'],
        ['api.openai.com/v1', 'scheme'],
        ['/v1', 'scheme'],
        ['ftp://example.com/v1', 'scheme'],
        ['file:///etc/passwd', 'scheme'],
        ['http://exa mple.com', 'invalid'],
        ['http://', 'invalid'],
    ] as const)('rejects %j (%s)', (raw, problem) => {
        expect(normalizeBaseUrl(raw)).toEqual({ ok: false, problem });
    });

    it('adds the default path only when the URL has none', () => {
        expect(normalizeBaseUrl('http://localhost:11434', { defaultPath: '/v1' })).toEqual({
            ok: true,
            url: 'http://localhost:11434/v1',
        });
        expect(normalizeBaseUrl('http://localhost:11434/', { defaultPath: '/v1' })).toEqual({
            ok: true,
            url: 'http://localhost:11434/v1',
        });
        expect(normalizeBaseUrl('http://localhost:11434/v1/', { defaultPath: '/v1' })).toEqual({
            ok: true,
            url: 'http://localhost:11434/v1',
        });
        expect(
            normalizeBaseUrl('https://proxy.example.com/ollama', { defaultPath: '/v1' }),
        ).toEqual({ ok: true, url: 'https://proxy.example.com/ollama' });
    });
});

describe('normalizeApiKey', () => {
    it('trims pasted spaces and newlines', () => {
        expect(normalizeApiKey('  sk-abc123 \n')).toBe('sk-abc123');
    });

    it('turns a blank key into no key', () => {
        expect(normalizeApiKey('   ')).toBeUndefined();
        expect(normalizeApiKey(undefined)).toBeUndefined();
    });
});

describe('isLocalBaseUrl', () => {
    it.each([
        ['http://localhost:11434/v1', true],
        ['http://127.0.0.1:1234/v1', true],
        ['http://[::1]:8080', true],
        ['https://ollama.com/v1', false],
        ['https://api.openai.com/v1', false],
        ['not a url', false],
        [undefined, false],
    ])('%j is local: %s', (url, local) => {
        expect(isLocalBaseUrl(url)).toBe(local);
    });
});

describe('normalizeCustomProvider', () => {
    it('trims every field and normalizes the URL', () => {
        expect(
            normalizeCustomProvider({
                id: 'lm',
                name: '  LM Studio ',
                baseUrl: ' http://127.0.0.1:1234/v1/ ',
                apiKey: ' key\n',
                defaultModel: ' qwen ',
                model: ' qwen-2 ',
            }),
        ).toEqual({
            id: 'lm',
            name: 'LM Studio',
            baseUrl: 'http://127.0.0.1:1234/v1',
            apiKey: 'key',
            defaultModel: 'qwen',
            model: 'qwen-2',
        });
    });

    it('throws on an unusable base URL', () => {
        expect(() =>
            normalizeCustomProvider({
                id: 'lm',
                name: 'LM',
                baseUrl: 'ftp://host',
                defaultModel: 'm',
            }),
        ).toThrow(/Invalid base URL/);
    });
});
