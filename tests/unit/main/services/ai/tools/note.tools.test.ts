import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSummaryMock = vi.fn();
const getByIdMock = vi.fn();
const createMock = vi.fn();
const renameMock = vi.fn();
const updateContentMock = vi.fn();

const markdownFailure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('@main/lib/note-markdown', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@main/lib/note-markdown')>();
    return {
        ...actual,
        markdownToNoteHtml: async (markdown: string) => {
            if (markdownFailure.error) throw markdownFailure.error;
            return actual.markdownToNoteHtml(markdown);
        },
    };
});

vi.mock('@main/database/repositories/notes.repository', () => ({
    getAllSummary: getAllSummaryMock,
    getById: getByIdMock,
    create: createMock,
    rename: renameMock,
    updateContent: updateContentMock,
}));

const { buildNoteTools } = await import('@main/services/ai/tools/note.tools');

const tools = buildNoteTools();

const NOTE_HTML =
    '<h1>Etude</h1><p>Premier paragraphe.</p><p>Deuxieme paragraphe.</p><ul><li>Alpha</li><li>Beta</li></ul>';

function mockNote(content: string, name = 'Etude', id = 'note-1') {
    getByIdMock.mockReturnValue({ id, name, content });
}

describe('note.tools', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        markdownFailure.error = null;
    });

    describe('getNoteById', () => {
        it('returns the canonical markdown projection of the stored HTML', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.getNoteById.execute({ noteId: 'note-1' });

            expect(result).toMatchObject({
                noteId: 'note-1',
                name: 'Etude',
                content:
                    '# Etude\n\nPremier paragraphe.\n\nDeuxieme paragraphe.\n\n-   Alpha\n-   Beta',
                hasMore: false,
            });
        });

        it('keeps reference links and inline marks readable', async () => {
            mockNote('<p>Voir <a href="http://w.t/#wmb/sermon/1/fr/2/3">le sermon</a> ici</p>');

            const result = await tools.getNoteById.execute({ noteId: 'note-1' });

            expect(result).toMatchObject({
                content: 'Voir [le sermon](wmb://sermon/1/fr/2/3) ici',
            });
        });

        it('paginates long notes by line', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.getNoteById.execute({
                noteId: 'note-1',
                startLine: 2,
                maxLines: 1,
            });

            expect(result).toMatchObject({
                content: 'Premier paragraphe.',
                totalLines: 8,
                startLine: 2,
                returnedLines: 1,
                hasMore: true,
            });
        });

        it('reports an unknown note', async () => {
            getByIdMock.mockReturnValue(null);

            expect(await tools.getNoteById.execute({ noteId: 'missing' })).toEqual({
                error: 'Note "missing" not found.',
            });
        });
    });

    describe('createNote', () => {
        it('stores the markdown as HTML and adds the title heading', async () => {
            createMock.mockReturnValue({ id: 'note-1' });

            const result = await tools.createNote.execute({
                name: 'Etude',
                content: 'Premier\n\nDeuxieme',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
            expect(updateContentMock).toHaveBeenCalledWith(
                'note-1',
                expect.stringContaining('<h1>Etude</h1>'),
            );
            expect(updateContentMock.mock.calls[0][1]).toContain('<p>Deuxieme</p>');
        });

        it('escapes the title it injects', async () => {
            createMock.mockReturnValue({ id: 'note-1' });

            await tools.createNote.execute({ name: '<script>x</script>', content: 'Texte' });

            expect(updateContentMock.mock.calls[0][1]).not.toContain('<script>');
        });

        it('returns the note id when writing the content fails so it can be retried', async () => {
            createMock.mockReturnValue({ id: 'note-1' });
            updateContentMock.mockImplementation(() => {
                throw new Error('disk full');
            });

            const result = (await tools.createNote.execute({
                name: 'Etude',
                content: 'Texte',
            })) as { noteId: string; error: string };

            expect(result).toMatchObject({ noteId: 'note-1', name: 'Etude' });
            expect(result.error).toContain('disk full');
        });
    });

    describe('editNote', () => {
        it('applies an anchored edit and keeps the untouched blocks', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.editNote.execute({
                noteId: 'note-1',
                edits: [{ oldText: 'Deuxieme paragraphe.', newText: 'Second paragraphe.' }],
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude', replacements: 1 });

            const [, savedHtml] = updateContentMock.mock.calls[0];
            expect(savedHtml).toContain('<p>Second paragraphe.</p>');
            expect(savedHtml).toContain('<h1>Etude</h1>');
            expect(savedHtml).toContain('<li>Alpha</li>');
        });

        it('does not save when an edit cannot be applied', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.editNote.execute({
                noteId: 'note-1',
                edits: [{ oldText: 'Absent du document', newText: 'X' }],
            });

            expect(result).toEqual({ error: expect.stringContaining('was not found') });
            expect(updateContentMock).not.toHaveBeenCalled();
        });

        it('points to the other tools when the note has no content yet', async () => {
            mockNote('');

            const result = await tools.editNote.execute({
                noteId: 'note-1',
                edits: [{ oldText: 'Alpha', newText: 'Beta' }],
            });

            expect(result).toEqual({ error: expect.stringContaining('is empty') });
            expect(updateContentMock).not.toHaveBeenCalled();
        });

        it('reports an unknown note', async () => {
            getByIdMock.mockReturnValue(null);

            expect(
                await tools.editNote.execute({
                    noteId: 'missing',
                    edits: [{ oldText: 'A', newText: 'B' }],
                }),
            ).toEqual({ error: 'Note "missing" not found.' });
        });
    });

    describe('appendToNote', () => {
        it('adds content after the existing HTML without rewriting it', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.appendToNote.execute({
                noteId: 'note-1',
                content: '## Conclusion\n\nDerniere pensee.',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });

            const [, savedHtml] = updateContentMock.mock.calls[0];
            expect(savedHtml.startsWith(NOTE_HTML)).toBe(true);
            expect(savedHtml).toContain('<h2>Conclusion</h2>');
            expect(savedHtml).toContain('<p>Derniere pensee.</p>');
        });

        it('does not add a title heading when the note is empty', async () => {
            mockNote('');

            await tools.appendToNote.execute({ noteId: 'note-1', content: 'Texte' });

            expect(updateContentMock).toHaveBeenCalledWith('note-1', '<p>Texte</p>');
        });
    });

    describe('updateNoteContent', () => {
        it('replaces the whole note and keeps the existing name as heading', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: 'Nouveau contenu',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
            expect(updateContentMock).toHaveBeenCalledWith(
                'note-1',
                '<h1>Etude</h1>\n<p>Nouveau contenu</p>',
            );
        });

        it.each([
            ['a table', '<table><tr><td>Alpha</td></tr></table>', 'a table'],
            ['a colour', '<p><span style="color: red">Rouge</span></p>', 'colours'],
            ['underline', '<p><u>Souligné</u></p>', 'underlined text'],
            ['strike-through', '<p><s>Barré</s></p>', 'struck-through text'],
            ['a highlight', '<p><mark>Surligné</mark></p>', 'highlighted text'],
            ['alignment', '<p style="text-align: center">Centré</p>', 'alignment'],
            ['a page break', '<div data-type="page-break"></div>', 'page breaks'],
        ])('refuses to rewrite a note holding %s', async (_case, formatted, label) => {
            mockNote(`<h1>Etude</h1><p>Texte simple.</p>${formatted}`);

            const result = (await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: 'Nouveau contenu',
            })) as { error: string };

            expect(result.error).toContain(label);
            expect(result.error).toContain('editNote');
            expect(result.error).toContain('appendToNote');
            expect(updateContentMock).not.toHaveBeenCalled();
        });

        it('rewrites a note whose links and plain marks markdown keeps', async () => {
            mockNote(
                '<h1>Etude</h1><p><strong>Gras</strong> et <em>italique</em> avec ' +
                    '<a href="http://w.t/#wmb/sermon/1/fr/2/3">le sermon</a>.</p><ul><li>Un</li></ul>',
            );

            const result = await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: 'Plus court, voir [le sermon](wmb://sermon/1/fr/2/3).',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
            expect(updateContentMock.mock.calls[0][1]).toContain(
                'href="http://w.t/#wmb/sermon/1/fr/2/3"',
            );
        });

        it('fills an empty note', async () => {
            mockNote('');

            const result = await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: 'Premier jet',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
        });

        it('stores malformed markdown as best it can instead of failing', async () => {
            mockNote(NOTE_HTML);

            const result = await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: '**pas fermé\n\n[lien cassé](\n\n# \n\n- ',
            });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
            expect(updateContentMock).toHaveBeenCalledOnce();
        });

        it('saves very long content whole', async () => {
            mockNote(NOTE_HTML);
            const paragraph = "L'amour de Dieu et le Saint-Esprit. ".repeat(40);
            const content = Array.from({ length: 400 }, () => paragraph).join('\n\n');

            const result = await tools.updateNoteContent.execute({ noteId: 'note-1', content });

            expect(result).toEqual({ noteId: 'note-1', name: 'Etude' });
            const saved = updateContentMock.mock.calls[0][1] as string;
            expect(saved.match(/<p>/g)).toHaveLength(400);
        });

        it('reports an unknown note', async () => {
            getByIdMock.mockReturnValue(null);

            expect(
                await tools.updateNoteContent.execute({ noteId: ' missing ', content: 'Texte' }),
            ).toEqual({ error: 'Note "missing" not found.' });
            expect(updateContentMock).not.toHaveBeenCalled();
        });

        it('returns an error when the markdown cannot be converted', async () => {
            mockNote(NOTE_HTML);
            markdownFailure.error = new Error('parser crashed');

            const result = (await tools.updateNoteContent.execute({
                noteId: 'note-1',
                content: 'Texte',
            })) as { error: string };

            expect(result.error).toContain('parser crashed');
            expect(updateContentMock).not.toHaveBeenCalled();
        });
    });

    describe('getNotes', () => {
        it('lists notes with their ids', async () => {
            getAllSummaryMock.mockReturnValue([{ id: 'note-1', name: 'Etude' }]);

            expect(await tools.getNotes.execute({})).toEqual([{ noteId: 'note-1', name: 'Etude' }]);
        });
    });
});

/**
 * getNoteById is the only thing the model sees before writing an anchor, so its content
 * must be exactly what editNote matches against. Any divergence makes anchors unfindable.
 */
describe('read and edit share one projection', () => {
    const NOTES = [
        NOTE_HTML,
        '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a> ici</p>',
        '<ul><li><p>Alpha</p></li><li><p>Beta</p></li></ul><blockquote><p>Cite</p></blockquote>',
        '<section><h1>Chapitre</h1><p>Importe.</p></section>',
        '<p>Ligne un<br>Ligne deux</p>',
    ];

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it.each(NOTES)(
        'anchors copied from the read output resolve when editing (%#)',
        async (html) => {
            mockNote(html);

            const page = (await tools.getNoteById.execute({ noteId: 'note-1' })) as {
                content: string;
            };
            const anchor = page.content
                .split('\n')
                .find((line) => line.trim().length > 3)
                ?.trim();
            expect(anchor, 'no usable anchor in the read output').toBeTruthy();

            const result = await tools.editNote.execute({
                noteId: 'note-1',
                edits: [{ oldText: anchor!, newText: anchor! }],
            });

            expect(result).not.toHaveProperty('error');
        },
    );

    it('edits a line holding a citation and stores the editor link back', async () => {
        mockNote(
            '<h1>Etude</h1>' +
                '<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a> sur la foi.</p>' +
                '<p>Et <a href="http://w.t/#reference-document-7">ma reference</a> perso.</p>',
        );

        const page = (await tools.getNoteById.execute({ noteId: 'note-1' })) as { content: string };
        const anchor = page.content.split('\n').find((line) => line.includes('le sermon'));
        expect(anchor).toBe('Voir [le sermon](wmb://sermon/56-0805/fr/3/45) sur la foi.');

        const result = await tools.editNote.execute({
            noteId: 'note-1',
            edits: [
                {
                    oldText: anchor!,
                    newText: 'Voir [le sermon](wmb://sermon/56-0805/fr/3/45) sur la grace.',
                },
            ],
        });

        expect(result).toMatchObject({ replacements: 1 });

        const [, savedHtml] = updateContentMock.mock.calls[0];
        expect(savedHtml).toContain(
            '<a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a> sur la grace.',
        );
        expect(savedHtml).toContain('<a href="http://w.t/#reference-document-7">ma reference</a>');
        expect(savedHtml).toContain('<h1>Etude</h1>');
    });

    it('hands the assistant wmb:// links it can copy straight back', async () => {
        mockNote('<p>Voir <a href="http://w.t/#wmb/sermon/56-0805/fr/3/45">le sermon</a></p>');

        const page = (await tools.getNoteById.execute({ noteId: 'note-1' })) as { content: string };
        expect(page.content).toContain('(wmb://sermon/56-0805/fr/3/45)');

        const result = await tools.editNote.execute({
            noteId: 'note-1',
            edits: [{ oldText: page.content, newText: 'Voir ailleurs' }],
        });

        expect(result).toMatchObject({ replacements: 1 });
        expect(updateContentMock.mock.calls[0][1]).toBe('<p>Voir ailleurs</p>');
    });
});
