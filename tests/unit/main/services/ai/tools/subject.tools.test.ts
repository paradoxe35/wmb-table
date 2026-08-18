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

const getSermonParagraphsMock = vi.fn();
const getSermonMetaMock = vi.fn();

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
    getSermonParagraphs: getSermonParagraphsMock,
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonMeta: getSermonMetaMock,
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
            paragraphNumber: 3,
        });

        expect(result).toEqual({ error: 'Subject "unknown" not found.' });
        expect(createItemMock).not.toHaveBeenCalled();
    });

    describe('the paragraph named the way sermon results name it', () => {
        beforeEach(() => {
            existsMock.mockReturnValue(true);
            getSermonMetaMock.mockReturnValue({
                sermonId: '65-0801',
                translationId: 7,
                title: 'Le Dieu de cet âge mauvais',
                dateMs: Date.UTC(1965, 7, 1),
            });
            getSermonParagraphsMock.mockResolvedValue([
                { paragraphIndex: 133, content: 'Le paragraphe cité.' },
            ]);
            createItemMock.mockReturnValue({ id: 'ref-1' });
        });

        it('adds the paragraph a result called paragraphNumber', async () => {
            const result = (await tools.addSermonReferenceToSubject.execute({
                subjectId: 'subject-1',
                sermonId: '65-0801',
                translationId: 7,
                paragraphNumber: 133,
            })) as { error?: string; referenceId?: string };

            expect(result.error).toBeUndefined();
            expect(result.referenceId).toBe('ref-1');
            expect(createItemMock).toHaveBeenCalledWith(
                'subject-1',
                'Le Dieu de cet âge mauvais',
                expect.objectContaining({ paragraphIndex: 133 }),
                'Le paragraphe cité.',
            );
        });
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
