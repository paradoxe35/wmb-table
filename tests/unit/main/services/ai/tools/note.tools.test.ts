import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSummaryMock = vi.fn();
const getByIdMock = vi.fn();
const createMock = vi.fn();
const renameMock = vi.fn();
const updateContentMock = vi.fn();

vi.mock('@main/database/repositories/notes.repository', () => ({
    getAllSummary: getAllSummaryMock,
    getById: getByIdMock,
    create: createMock,
    rename: renameMock,
    updateContent: updateContentMock,
}));

const { buildNoteTools } = await import('@main/services/ai/tools/note.tools');

describe('note.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('converts stored note HTML into markdown for the AI', async () => {
        getByIdMock.mockReturnValue({
            id: 'note-1',
            name: 'Study',
            content:
                '<h1>Study</h1><p>Hello <a href="http://w.t/#wmb/sermon/1/2/3">world</a></p><p>Second line</p>',
        });

        const tools = buildNoteTools('fr');
        const result = await tools.getNoteById.execute({ noteId: 'note-1' });

        expect(result).toEqual({
            noteId: 'note-1',
            name: 'Study',
            content: 'Study\n=====\nHello [world](http://w.t/#wmb/sermon/1/2/3)\nSecond line',
        });
    });

    it('getNoteById preserves markdown formatting produced from stored HTML', async () => {
        getByIdMock.mockReturnValue({
            id: 'note-2',
            name: 'Title',
            content: '<h1>Title</h1><p>Alpha <strong>Beta</strong></p><p>Gamma</p>',
        });

        const tools = buildNoteTools('fr');
        const result = await tools.getNoteById.execute({ noteId: 'note-2' });

        expect(result).toEqual({
            noteId: 'note-2',
            name: 'Title',
            content: 'Title\n=====\nAlpha **Beta**\nGamma',
        });
    });

    it('getNoteById keeps turndown list and entity output', async () => {
        getByIdMock.mockReturnValue({
            id: 'note-3',
            name: 'List',
            content: '<ul><li>Alpha &amp; Beta</li><li>Gamma&nbsp;Delta</li></ul>',
        });

        const tools = buildNoteTools('fr');
        const result = await tools.getNoteById.execute({ noteId: 'note-3' });

        expect(result).toEqual({
            noteId: 'note-3',
            name: 'List',
            content: '*   Alpha & Beta\n*   Gamma\u00A0Delta',
        });
    });
});
