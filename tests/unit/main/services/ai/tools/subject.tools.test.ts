import { beforeEach, describe, expect, it, vi } from 'vitest';

const existsMock = vi.fn();
const getByIdMock = vi.fn();
const getAllSummaryMock = vi.fn();
const createMock = vi.fn();
const createItemMock = vi.fn();
const deleteItemMock = vi.fn();
const getInstalledLanguagesMock = vi.fn(() => ['fr']);

vi.mock('@main/database/repositories/subjects.repository', () => ({
    exists: existsMock,
    getById: getByIdMock,
    getAllSummary: getAllSummaryMock,
    create: createMock,
    createItem: createItemMock,
    deleteItem: deleteItemMock,
}));

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
    getSermonParagraphs: vi.fn(),
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonMeta: vi.fn(),
    getSermonListForLanguage: vi.fn(() => []),
    getTranslationsForSermonInLanguage: vi.fn(() => []),
}));

const { buildSubjectTools } = await import('@main/services/ai/tools/subject.tools');

const tools = buildSubjectTools('fr');

describe('subject.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstalledLanguagesMock.mockReturnValue(['fr']);
    });

    it('rejects a hallucinated subject id instead of hitting the foreign key', async () => {
        existsMock.mockReturnValue(false);

        const result = await tools.addSermonReferenceToSubject.execute({
            subjectId: 'unknown',
            sermonId: '56-0805',
            paragraphIndex: 3,
        });

        expect(result).toEqual({ error: 'Subject "unknown" not found.' });
        expect(createItemMock).not.toHaveBeenCalled();
    });

    it('turns a duplicate subject name into a recoverable tool error', async () => {
        createMock.mockImplementation(() => {
            throw new Error('Un sujet avec ce nom existe déjà.');
        });

        const result = await tools.createSubject.execute({ name: 'La foi' });

        expect(result).toEqual({
            error: expect.stringContaining('Un sujet avec ce nom existe déjà.'),
        });
    });

    it('creates a subject when the name is free', async () => {
        createMock.mockReturnValue({ id: 'subject-1', name: 'La foi' });

        expect(await tools.createSubject.execute({ name: 'La foi' })).toEqual({
            subjectId: 'subject-1',
            name: 'La foi',
        });
    });
});
