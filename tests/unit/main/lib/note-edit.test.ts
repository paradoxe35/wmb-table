import { describe, expect, it } from 'vitest';
import { applyNoteEdits, type NoteEditSuccess } from '@main/lib/note-edit';
import { noteHtmlToMarkdown } from '@main/lib/note-markdown';

const NOTE_HTML =
    '<h1>Etude</h1><p>La foi vient de ce quon entend.</p><p>Le prophete a dit ceci.</p><ul><li>Point A</li><li>Point B</li></ul>';

async function edit(html: string, edits: Parameters<typeof applyNoteEdits>[1]) {
    return applyNoteEdits(html, edits);
}

function expectSuccess(outcome: Awaited<ReturnType<typeof edit>>): NoteEditSuccess {
    if ('error' in outcome) throw new Error(`expected success, got: ${outcome.error}`);
    return outcome;
}

describe('applyNoteEdits', () => {
    it('replaces a snippet and leaves untouched blocks byte-identical', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [
                { oldText: 'Le prophete a dit ceci.', newText: 'Le prophete a dit autre chose.' },
            ]),
        );

        expect(result.replacements).toBe(1);
        expect(result.html).toContain('<p>Le prophete a dit autre chose.</p>');
        expect(result.html).toContain('<h1>Etude</h1>');
        expect(result.html).toContain('<p>La foi vient de ce quon entend.</p>');
        expect(result.html).toContain('<li>Point A</li>');
    });

    it('edits part of a line without touching the rest of the block', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [{ oldText: 'Point B', newText: 'Point C' }]),
        );

        expect(result.html).toContain('<li>Point A</li>');
        expect(result.html).toContain('<li>Point C</li>');
        expect(result.html).not.toContain('Point B');
    });

    it('applies several edits in one atomic call', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [
                { oldText: '# Etude', newText: '# Etude sur la foi' },
                { oldText: 'Point A', newText: 'Premier point' },
            ]),
        );

        expect(result.replacements).toBe(2);
        expect(result.html).toContain('<h1>Etude sur la foi</h1>');
        expect(result.html).toContain('<li>Premier point</li>');
    });

    it('inserts new blocks when the replacement spans paragraphs', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [
                {
                    oldText: 'Le prophete a dit ceci.',
                    newText: '## Section\n\nLe prophete a dit ceci.\n\nUne precision.',
                },
            ]),
        );

        expect(result.html).toContain('<h2>Section</h2>');
        expect(result.html).toContain('<p>Une precision.</p>');
        expect(result.html).toContain('<h1>Etude</h1>');
    });

    it('deletes a snippet when newText is empty', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [{ oldText: 'Le prophete a dit ceci.', newText: '' }]),
        );

        expect(result.html).not.toContain('Le prophete a dit ceci.');
        expect(result.html).toContain('<h1>Etude</h1>');
        expect(result.html).toContain('<li>Point A</li>');
    });

    it('matches an anchor the model re-wrapped across lines', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [
                { oldText: 'La foi vient\n  de ce quon entend.', newText: 'La foi vient de Dieu.' },
            ]),
        );

        expect(result.html).toContain('<p>La foi vient de Dieu.</p>');
    });

    it('renders wmb links added by an edit', async () => {
        const result = expectSuccess(
            await edit(NOTE_HTML, [
                {
                    oldText: 'Point A',
                    newText: '[Jean 3:16](wmb://bible/43N/3/16/lsg/Jean)',
                },
            ]),
        );

        expect(result.html).toContain('href="http://w.t/#wmb/bible/43N/3/16/lsg/Jean"');
    });

    it('rejects an ambiguous anchor and reports the match count', async () => {
        const html = '<p>Le prophete a dit ceci.</p><p>Le prophete a dit ceci.</p>';
        const outcome = await edit(html, [{ oldText: 'Le prophete', newText: 'Il' }]);

        expect(outcome).toEqual({
            error: expect.stringContaining('matches 2 places'),
        });
    });

    it('replaces every occurrence when replaceAll is set', async () => {
        const html = '<p>Le prophete a dit ceci.</p><p>Le prophete a dit cela.</p>';
        const result = expectSuccess(
            await edit(html, [{ oldText: 'Le prophete', newText: 'Il', replaceAll: true }]),
        );

        expect(result.replacements).toBe(2);
        expect(result.html).toContain('<p>Il a dit ceci.</p>');
        expect(result.html).toContain('<p>Il a dit cela.</p>');
    });

    it('rejects an anchor that is not in the note', async () => {
        const outcome = await edit(NOTE_HTML, [{ oldText: 'Absent', newText: 'X' }]);

        expect(outcome).toEqual({ error: expect.stringContaining('was not found') });
    });

    it('leaves the note unchanged when a later edit fails', async () => {
        const outcome = await edit(NOTE_HTML, [
            { oldText: 'Point A', newText: 'Premier point' },
            { oldText: 'Absent', newText: 'X' },
        ]);

        expect(outcome).toEqual({ error: expect.stringContaining('Edit 2') });
    });

    it('refuses to edit a table block instead of destroying it', async () => {
        const html = '<p>Avant</p><table><tbody><tr><td>Cellule</td></tr></tbody></table>';
        const outcome = await edit(html, [{ oldText: 'Cellule', newText: 'Autre' }]);

        expect(outcome).toEqual({
            error: expect.stringContaining('formatting that markdown cannot carry'),
        });
    });

    it('keeps an untouched table intact while editing around it', async () => {
        const html =
            '<p>Avant</p><table><tbody><tr><td>Cellule</td></tr></tbody></table><p>Apres</p>';
        const result = expectSuccess(await edit(html, [{ oldText: 'Apres', newText: 'Ensuite' }]));

        expect(result.html).toContain('<table><tbody><tr><td>Cellule</td></tr></tbody></table>');
        expect(result.html).toContain('<p>Ensuite</p>');
    });

    it('reports ambiguity when a re-wrapped anchor also matches across blocks', async () => {
        const html = '<h1>Alpha Beta</h1><p>Un Alpha</p><p>Beta deux</p>';
        const outcome = await edit(html, [{ oldText: 'Alpha\n  Beta', newText: 'Gamma' }]);

        expect(outcome).toEqual({ error: expect.stringContaining('matches 2 places') });
    });

    it('edits inside a link label without breaking the link', async () => {
        const html = '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a></p>';
        const result = expectSuccess(
            await edit(html, [{ oldText: 'le sermon', newText: 'ce prêche' }]),
        );

        expect(result.html).toContain('href="http://w.t/#wmb/sermon/56-0805/fr/3/45"');
        expect(result.html).toContain('>ce prêche</a>');
    });

    it('refuses an anchor that cuts through a reference link', async () => {
        const html = '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a></p>';
        const outcome = await edit(html, [{ oldText: 'Voir [le sermon', newText: 'Lire' }]);

        expect(outcome).toEqual({ error: expect.stringContaining('cuts through a markdown link') });
    });

    it('allows an edit that replaces a whole reference link', async () => {
        const html = '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a></p>';
        const result = expectSuccess(
            await edit(html, [
                {
                    oldText: '[le sermon](http://w.t/#wmb/sermon/56-0805/fr/3/45)',
                    newText: '[Jean 3:16](wmb://bible/43N/3/16/lsg/Jean)',
                },
            ]),
        );

        expect(result.html).toContain('href="http://w.t/#wmb/bible/43N/3/16/lsg/Jean"');
        expect(result.html).not.toContain('56-0805');
    });

    it('applies batched edits in order, each seeing the previous result', async () => {
        const html = '<p>Alpha</p><p>Beta</p>';
        const result = expectSuccess(
            await edit(html, [
                { oldText: 'Alpha', newText: 'Gamma' },
                { oldText: 'Gamma', newText: 'Delta' },
            ]),
        );

        expect(result.html).toBe('<p>Delta</p>\n<p>Beta</p>');
    });

    it('reports ambiguity that an earlier edit in the same batch introduced', async () => {
        const html = '<p>Alpha</p><p>Beta</p>';
        const outcome = await edit(html, [
            { oldText: 'Alpha', newText: 'Beta' },
            { oldText: 'Beta', newText: 'Gamma' },
        ]);

        expect(outcome).toEqual({ error: expect.stringContaining('Edit 2') });
    });

    it('edits editor-style lists without leaving stray indentation', async () => {
        const html = '<ul><li><p>Alpha</p></li><li><p>Beta</p></li></ul>';
        const result = expectSuccess(await edit(html, [{ oldText: 'Beta', newText: 'Gamma' }]));

        expect(noteHtmlToMarkdown(result.html)).toBe('-   Alpha\n\n-   Gamma');
    });

    it('preserves hard line breaks through an edit', async () => {
        const html = '<p>Ligne un<br>Ligne deux</p>';
        const result = expectSuccess(await edit(html, [{ oldText: 'Ligne deux', newText: 'Fin' }]));

        expect(result.html).toContain('<br>');
        expect(noteHtmlToMarkdown(result.html)).toBe('Ligne un\\\nFin');
    });
});

describe('applyNoteEdits at scale', () => {
    const LARGE_NOTE = Array.from(
        { length: 2000 },
        (_, index) =>
            `<p>Paragraphe numero ${index} du sermon, avec assez de texte pour etre realiste.</p>`,
    ).join('');

    it('stays linear on a note far larger than any real one', async () => {
        const edits = Array.from({ length: 20 }, (_, index) => ({
            oldText: `Paragraphe numero ${index * 7} du`,
            newText: `Paragraphe revise ${index} du`,
        }));

        const started = performance.now();
        const result = expectSuccess(await applyNoteEdits(LARGE_NOTE, edits));
        const elapsed = performance.now() - started;

        expect(result.replacements).toBe(20);
        expect(result.html).toContain('<p>Paragraphe revise 19 du sermon');
        expect(result.html).toContain('<p>Paragraphe numero 1999 du sermon');
        expect(elapsed).toBeLessThan(5000);
    });
});

describe('list markers', () => {
    it('keeps the item when the replacement carries the bullet', async () => {
        const html = '<ul><li><p>Point A</p></li><li><p>Point B</p></li></ul>';
        const result = expectSuccess(
            await applyNoteEdits(html, [{ oldText: '-   Point B', newText: '-   Point C' }]),
        );

        expect(noteHtmlToMarkdown(result.html)).toBe('-   Point A\n\n-   Point C');
    });

    it('removes the item cleanly when the whole line is deleted', async () => {
        const html = '<ul><li><p>Point A</p></li><li><p>Point B</p></li></ul>';
        const result = expectSuccess(
            await applyNoteEdits(html, [{ oldText: '-   Point B', newText: '' }]),
        );

        expect(noteHtmlToMarkdown(result.html)).toBe('-   Point A');
    });
});

describe('imported notes', () => {
    const EPUB_NOTE =
        '<section><h1>Chapitre</h1><p>Premier paragraphe.</p><p>Deuxieme paragraphe.</p></section>';

    it('edits one paragraph of an imported chapter without rewriting the rest', async () => {
        const result = expectSuccess(
            await applyNoteEdits(EPUB_NOTE, [
                { oldText: 'Deuxieme paragraphe.', newText: 'Second paragraphe.' },
            ]),
        );

        expect(result.html).toBe(
            '<h1>Chapitre</h1>\n<p>Premier paragraphe.</p>\n<p>Second paragraphe.</p>',
        );
    });
});
