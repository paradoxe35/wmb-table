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

const { buildNoteTools, htmlToReadableText } = await import('@main/services/ai/tools/note.tools');

describe('note.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('converts stored note HTML into readable text for the AI', async () => {
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
            content: 'Study\nHello world\nSecond line',
        });
    });

    it('htmlToReadableText removes markup noise and preserves readable structure', () => {
        expect(
            htmlToReadableText('<h1>Title</h1><p>Alpha <strong>Beta</strong></p><p>Gamma</p>'),
        ).toBe('Title\nAlpha Beta\nGamma');
    });

    it('htmlToReadableText decodes common entities and list structure', () => {
        expect(
            htmlToReadableText('<ul><li>Alpha &amp; Beta</li><li>Gamma&nbsp;Delta</li></ul>'),
        ).toBe('- Alpha & Beta\n- Gamma Delta');
    });
});
