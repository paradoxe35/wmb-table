import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl } from '@shared/external-url';
import {
    buildDocsGuideLink,
    buildDocsLink,
    buildDownloadPageLink,
    DOCS_CONTACT_LINK,
    DOCS_LINK,
    WEBSITE_LINK,
} from '@shared/constants';
import { PROVIDER_CATALOG } from '@shared/tts.types';
import { getAiProviderCatalog } from '@main/services/ai/provider-catalog';

function linksOpenedByTheApp(): string[] {
    const languages = ['fr', 'en', 'es', 'pt', 'sw', null];
    const ttsKeyUrls = Object.values(PROVIDER_CATALOG).map(
        (meta) => (meta as { apiKeyUrl?: string }).apiKeyUrl,
    );
    const aiKeyUrls = getAiProviderCatalog().map((provider) => provider.apiKeyUrl);
    return [
        DOCS_LINK,
        WEBSITE_LINK,
        DOCS_CONTACT_LINK,
        ...languages.flatMap((language) => [
            buildDocsGuideLink('settings-assistant', language),
            buildDocsGuideLink('audio-and-tts', language),
            buildDocsLink('contact', language),
            buildDownloadPageLink(language),
        ]),
        ...ttsKeyUrls,
        ...aiKeyUrls,
    ].filter((url): url is string => Boolean(url));
}

describe('toSafeExternalUrl', () => {
    it.each([
        [
            'https://wmb-table.web.app/fr/guide/ai-chat',
            'https://wmb-table.web.app/fr/guide/ai-chat',
        ],
        ['http://example.com', 'http://example.com/'],
        ['mailto:contact@example.com', 'mailto:contact@example.com'],
        ['HTTPS://Example.COM/Path', 'https://example.com/Path'],
        ['MailTo:someone@example.com', 'mailto:someone@example.com'],
        ['  https://example.com/a  ', 'https://example.com/a'],
        ['https://example.com/%2e%2e/secret', 'https://example.com/secret'],
        [
            'https://example.com/l\u2019amour?q=Saint-Esprit',
            'https://example.com/l%E2%80%99amour?q=Saint-Esprit',
        ],
        [
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=http%3A%2F%2F127.0.0.1%3A5000',
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=http%3A%2F%2F127.0.0.1%3A5000',
        ],
        ['http://localhost:11434/v1', 'http://localhost:11434/v1'],
    ])('allows %s', (input, expected) => {
        expect(toSafeExternalUrl(input)).toBe(expected);
    });

    it.each([
        ['file:///C:/Windows/System32/calc.exe'],
        ['FILE:///etc/passwd'],
        ['javascript:alert(1)'],
        ['JavaScript:alert(1)'],
        ['data:text/html,<script>alert(1)</script>'],
        ['vbscript:msgbox(1)'],
        ['wmb://sermon/abc/fr/1/2'],
        ['ms-msdt:/id PCWDiagnostic'],
        ['smb://server/share'],
        ['xmpp:user@example.com'],
        ['../../../../Windows/System32/calc.exe'],
        ['./notes.html'],
        ['/etc/passwd'],
        ['#section'],
        ['//evil.example.com/path'],
        ['example.com'],
        ['%6A%61vascript:alert(1)'],
        ['java\nscript:alert(1)'],
        ['https://exa\tmple.com'],
        ['https://example.com/\u0000'],
        ['\u0001https://example.com'],
        ['https://'],
        ['http:'],
        [''],
        ['   '],
        [`https://example.com/${'a'.repeat(20_000)}`],
    ])('refuses %j', (input) => {
        expect(toSafeExternalUrl(input)).toBeNull();
    });

    it('allows every link the app itself opens', () => {
        const links = linksOpenedByTheApp();
        expect(links.length).toBeGreaterThan(20);
        for (const link of links) {
            expect(toSafeExternalUrl(link), link).not.toBeNull();
        }
    });

    it.each([[undefined], [null], [42], [{ href: 'https://example.com' }], [['https://a.b']]])(
        'refuses the non-string %j',
        (input) => {
            expect(toSafeExternalUrl(input)).toBeNull();
        },
    );
});
