import { describe, expect, it } from 'vitest';
import {
    findUnsupportedFormatting,
    markdownToNoteHtml,
    noteHtmlToBlocks,
    noteHtmlToMarkdown,
    splitHtmlBlocks,
} from '@main/lib/note-markdown';

describe('splitHtmlBlocks', () => {
    it('splits flat editor output into top-level elements', () => {
        expect(splitHtmlBlocks('<h1>Titre</h1><p>Alpha</p><p>Beta</p>')).toEqual([
            '<h1>Titre</h1>',
            '<p>Alpha</p>',
            '<p>Beta</p>',
        ]);
    });

    it('keeps nested elements inside their parent block', () => {
        expect(splitHtmlBlocks('<ul><li>A</li><li>B</li></ul><p>C</p>')).toEqual([
            '<ul><li>A</li><li>B</li></ul>',
            '<p>C</p>',
        ]);
    });

    it('handles same-name nesting, void tags and attributes containing angle brackets', () => {
        const html =
            '<blockquote><blockquote><p>Deep</p></blockquote></blockquote><hr><p title="a > b">X</p>';

        expect(splitHtmlBlocks(html)).toEqual([
            '<blockquote><blockquote><p>Deep</p></blockquote></blockquote>',
            '<hr>',
            '<p title="a > b">X</p>',
        ]);
    });

    it('ignores whitespace between blocks', () => {
        expect(splitHtmlBlocks('<p>A</p>\n\n  <p>B</p>\n')).toEqual(['<p>A</p>', '<p>B</p>']);
    });

    it('returns nothing for empty input', () => {
        expect(splitHtmlBlocks('')).toEqual([]);
        expect(splitHtmlBlocks('   \n ')).toEqual([]);
    });
});

describe('noteHtmlToMarkdown', () => {
    it('separates blocks with a blank line so markdown structure survives', () => {
        const markdown = noteHtmlToMarkdown(
            '<h1>Etude</h1><p>Premier</p><p>Deuxieme</p><ul><li>A</li><li>B</li></ul><p>Fin</p>',
        );

        expect(markdown).toBe('# Etude\n\nPremier\n\nDeuxieme\n\n-   A\n-   B\n\nFin');
    });

    it('round-trips back to the same block structure', async () => {
        const html = '<h1>Etude</h1><p>Premier</p><p>Deuxieme</p><ul><li>A</li><li>B</li></ul>';
        const rendered = await markdownToNoteHtml(noteHtmlToMarkdown(html));

        expect(splitHtmlBlocks(rendered)).toEqual([
            '<h1>Etude</h1>',
            '<p>Premier</p>',
            '<p>Deuxieme</p>',
            '<ul>\n<li>A</li>\n<li>B</li>\n</ul>',
        ]);
    });

    it('preserves editor reference links and inline marks', () => {
        const markdown = noteHtmlToMarkdown(
            '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a> et <strong>ceci</strong></p>',
        );

        expect(markdown).toBe(
            'Voir [le sermon](http://w.t/#wmb/sermon/56-0805/fr/3/45) et **ceci**',
        );
    });

    it('is identical whether a note or a single block is converted', () => {
        const blocks = noteHtmlToBlocks('<h1>T</h1><p>Alpha</p>');

        expect(noteHtmlToMarkdown('<h1>T</h1><p>Alpha</p>')).toBe(
            blocks.map((block) => block.markdown).join('\n\n'),
        );
    });
});

describe('markdownToNoteHtml', () => {
    it('rewrites wmb:// links to the editor link format', async () => {
        const html = await markdownToNoteHtml('[Jean 3:16](wmb://bible/43N/3/16/lsg/Jean)');

        expect(html).toContain('href="http://w.t/#wmb/bible/43N/3/16/lsg/Jean"');
    });

    it('unwraps wmb links the model wrapped in a code span and encodes spaces', async () => {
        const html = await markdownToNoteHtml('`[Le Premier Sceau](wmb://doc/id 7/Le Sceau)`');

        expect(html).toContain('href="http://w.t/#wmb/doc/id%207/Le%20Sceau"');
        expect(html).not.toContain('<code>');
    });
});

/**
 * Every construct the notes editor can produce, and whether markdown can carry it.
 * Anything unsupported must be refused by an edit rather than silently dropped.
 */
const EDITOR_CONSTRUCTS: { name: string; html: string; supported: boolean }[] = [
    { name: 'paragraph', html: '<p>Texte</p>', supported: true },
    { name: 'heading', html: '<h2>Titre</h2>', supported: true },
    { name: 'bold', html: '<p><strong>gras</strong></p>', supported: true },
    { name: 'italic', html: '<p><em>italique</em></p>', supported: true },
    { name: 'inline code', html: '<p><code>x</code></p>', supported: true },
    { name: 'code block', html: '<pre><code>x</code></pre>', supported: true },
    { name: 'blockquote', html: '<blockquote><p>cite</p></blockquote>', supported: true },
    { name: 'bullet list', html: '<ul><li><p>A</p></li></ul>', supported: true },
    { name: 'ordered list', html: '<ol><li><p>A</p></li></ol>', supported: true },
    { name: 'horizontal rule', html: '<hr>', supported: true },
    { name: 'hard break', html: '<p>A<br>B</p>', supported: true },
    { name: 'image', html: '<p><img src="data:image/png;base64,AA" alt="x"></p>', supported: true },
    {
        name: 'link',
        html: '<p><a href="http://w.t/#wmb/sermon/1/fr/2/3">l</a></p>',
        supported: true,
    },
    {
        name: 'reference link',
        html: '<p><a href="http://w.t/#reference-document-7" reference="true">r</a></p>',
        supported: true,
    },
    { name: 'table', html: '<table><tbody><tr><td>A</td></tr></tbody></table>', supported: false },
    { name: 'text align', html: '<p style="text-align: center">A</p>', supported: false },
    { name: 'indent', html: '<p style="margin-left: 2em">A</p>', supported: false },
    { name: 'colour', html: '<p><span style="color: rgb(1,2,3)">A</span></p>', supported: false },
    { name: 'underline', html: '<p><u>A</u></p>', supported: false },
    { name: 'strike', html: '<p><s>A</s></p>', supported: false },
    { name: 'subscript', html: '<p>H<sub>2</sub>O</p>', supported: false },
    { name: 'superscript', html: '<p>1<sup>er</sup></p>', supported: false },
    {
        name: 'task list',
        html: '<ul data-type="taskList"><li data-checked="true"><p>A</p></li></ul>',
        supported: false,
    },
    { name: 'page break', html: '<div data-page-break=""></div>', supported: false },
    { name: 'language span', html: '<p><span lang="en">A</span></p>', supported: false },
];

describe('findUnsupportedFormatting', () => {
    it.each(EDITOR_CONSTRUCTS)('classifies $name', ({ html, supported }) => {
        expect(findUnsupportedFormatting(html) === null).toBe(supported);
    });

    it.each(EDITOR_CONSTRUCTS.filter((entry) => entry.supported))(
        'round-trips $name without losing markup',
        async ({ html }) => {
            const rendered = await markdownToNoteHtml(noteHtmlToMarkdown(html));
            const text = (value: string) => value.replace(/<[^>]+>/g, '').trim();

            expect(text(rendered)).toBe(text(html));
            expect(await markdownToNoteHtml(noteHtmlToMarkdown(rendered))).toBe(rendered);
        },
    );

    it('does not flag attribute-like words in ordinary prose', () => {
        expect(findUnsupportedFormatting('<p>Le style="ancien" de la chaire</p>')).toBeNull();
    });

    it('does not confuse tag names that merely start with a lossy letter', () => {
        expect(findUnsupportedFormatting('<p><strong>A</strong> <span>B</span></p>')).toBeNull();
    });
});

describe('imported document HTML', () => {
    it('splits inside the section wrapper an epub import produces', () => {
        const html =
            '<section><h1>Chapitre</h1><p>Premier.</p><p>Deuxieme.</p></section>' +
            '<section><h1>Suite</h1><p>Troisieme.</p></section>';

        expect(splitHtmlBlocks(html)).toEqual([
            '<h1>Chapitre</h1>',
            '<p>Premier.</p>',
            '<p>Deuxieme.</p>',
            '<h1>Suite</h1>',
            '<p>Troisieme.</p>',
        ]);
    });

    it('sees through a full xhtml chapter document', () => {
        const html =
            '<section><html xmlns="http://www.w3.org/1999/xhtml"><body><p>Alpha</p><p>Beta</p></body></html></section>';

        expect(splitHtmlBlocks(html)).toEqual(['<p>Alpha</p>', '<p>Beta</p>']);
    });

    it('unwraps bare divs but keeps a page break node whole', () => {
        expect(splitHtmlBlocks('<div><p>A</p></div>')).toEqual(['<p>A</p>']);
        expect(splitHtmlBlocks('<div data-page-break=""></div>')).toEqual([
            '<div data-page-break=""></div>',
        ]);
    });

    it('keeps the docx importer output block-addressable', () => {
        const html = '<h1>Titre</h1><p>Texte <strong>gras</strong></p><ul><li>Point</li></ul>';

        expect(splitHtmlBlocks(html)).toHaveLength(3);
        expect(noteHtmlToMarkdown(html)).toBe('# Titre\n\nTexte **gras**\n\n-   Point');
    });

    it('stops unwrapping instead of recursing without bound', () => {
        const nested = `${'<div>'.repeat(40)}<p>A</p>${'</div>'.repeat(40)}`;

        expect(splitHtmlBlocks(nested)).toHaveLength(1);
    });
});
