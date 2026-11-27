import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import {
    classifyProviderTestError,
    PROVIDER_TEST_FAILURE_TEXT,
} from '@renderer/views/options/settings/ai-provider-test-error';

describe('classifyProviderTestError', () => {
    it.each([
        ['Incorrect API key provided: sk-abc. You can find your API key at …', 'auth'],
        ['401 Unauthorized', 'auth'],
        ['Forbidden', 'auth'],
        ['The model `gpt-9` does not exist or you do not have access to it.', 'not-found'],
        ['Not Found', 'not-found'],
        ['Cannot connect to API: fetch failed', 'network'],
        ['connect ECONNREFUSED 127.0.0.1:1234', 'network'],
        ['getaddrinfo ENOTFOUND api.example.invalid', 'network'],
        ['Something odd happened', 'unknown'],
        ['', 'unknown'],
    ] as const)('%j is %s', (message, kind) => {
        expect(classifyProviderTestError(message)).toBe(kind);
    });

    it('has a translation for every failure text', () => {
        for (const text of Object.values(PROVIDER_TEST_FAILURE_TEXT)) {
            for (const locale of [en, es, pt, sw]) {
                expect(locale[text], text).toBeTruthy();
            }
        }
    });
});
