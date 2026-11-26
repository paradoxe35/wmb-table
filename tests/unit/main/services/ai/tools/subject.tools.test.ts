import { beforeEach, describe, expect, it, vi } from 'vitest';

const existsMock = vi.fn();
const getByIdMock = vi.fn();
const getAllSummaryMock = vi.fn();
const createMock = vi.fn();
const createItemMock = vi.fn();
const deleteItemMock = vi.fn();
const getItemMock = vi.fn();
const getInstalledLanguagesMock = vi.fn(() => ['fr']);

vi.mock('@main/database/repositories/subjects.repository', () => ({
    exists: existsMock,
    getById: getByIdMock,
    getAllSummary: getAllSummaryMock,
    create: createMock,
    createItem: createItemMock,
    deleteItem: deleteItemMock,
    getItem: getItemMock,
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

    it('points to the existing subject when the name is taken', async () => {
        getAllSummaryMock.mockReturnValue([{ id: 'subject-9', name: 'La foi', date: '' }]);

        const result = (await tools.createSubject.execute({ name: ' La foi ' })) as {
            error?: string;
        };

        expect(result.error).toBe(
            'A subject named "La foi" already exists (subjectId "subject-9"). Use that subject instead of creating a new one.',
        );
        expect(createMock).not.toHaveBeenCalled();
    });

    it('turns a failed subject creation into a tool error', async () => {
        getAllSummaryMock.mockReturnValue([]);
        createMock.mockImplementation(() => {
            throw new Error('database is locked');
        });

        const result = await tools.createSubject.execute({ name: 'La foi' });

        expect(result).toEqual({ error: 'Failed to create subject: database is locked' });
    });

    it('creates a subject when the name is free', async () => {
        getAllSummaryMock.mockReturnValue([{ id: 'subject-9', name: 'La grâce', date: '' }]);
        createMock.mockReturnValue({ id: 'subject-1', name: 'La foi' });

        expect(await tools.createSubject.execute({ name: 'La foi' })).toEqual({
            subjectId: 'subject-1',
            name: 'La foi',
        });
    });

    describe('addSermonReferenceToSubject failures', () => {
        const INPUT = { subjectId: 'subject-1', sermonId: '65-0801', translationId: 7 };

        beforeEach(() => {
            existsMock.mockReturnValue(true);
            getSermonMetaMock.mockReturnValue({
                sermonId: '65-0801',
                translationId: 7,
                title: 'Le Dieu de cet âge mauvais',
                dateMs: Date.UTC(1965, 7, 1),
            });
            getSermonParagraphsMock.mockResolvedValue([
                { paragraphIndex: 1, content: 'Premier.' },
                { paragraphIndex: 2, content: 'Deuxième.' },
            ]);
        });

        it('explains an unknown sermon in English with a next step', async () => {
            getSermonMetaMock.mockReturnValue(null);

            const result = (await tools.addSermonReferenceToSubject.execute({
                ...INPUT,
                paragraphNumber: 1,
            })) as { error?: string };

            expect(result.error).toBe(
                'Sermon "65-0801" not found for language "fr". Use searchSermons to find its sermonId and translationId.',
            );
        });

        it('explains an unknown paragraph with the range the sermon has', async () => {
            const result = (await tools.addSermonReferenceToSubject.execute({
                ...INPUT,
                paragraphNumber: 42,
            })) as { error?: string };

            expect(result.error).toBe(
                'Paragraph 42 not found in sermon "65-0801"; its paragraphs are numbered 1 to 2.',
            );
            expect(createItemMock).not.toHaveBeenCalled();
        });

        it('returns an error when saving the reference fails', async () => {
            createItemMock.mockImplementation(() => {
                throw new Error('FOREIGN KEY constraint failed');
            });

            const result = (await tools.addSermonReferenceToSubject.execute({
                ...INPUT,
                paragraphNumber: 2,
            })) as { error?: string };

            expect(result.error).toBe('Failed to add the reference: FOREIGN KEY constraint failed');
        });
    });

    describe('removeSubjectReference', () => {
        const ITEM = { id: 'ref-1', subjectId: 'subject-1', documentTitle: 'La foi parfaite' };

        beforeEach(() => {
            existsMock.mockImplementation((id: string) => id === 'subject-1' || id === 'subject-2');
            getItemMock.mockImplementation((id: string) => (id === 'ref-1' ? ITEM : null));
        });

        it('removes a reference of the named subject and says what it removed', async () => {
            const result = await tools.removeSubjectReference.execute({
                subjectId: ' subject-1 ',
                referenceId: ' ref-1 ',
            });

            expect(result).toEqual({
                success: true,
                deletedId: 'ref-1',
                subjectId: 'subject-1',
                documentTitle: 'La foi parfaite',
            });
            expect(deleteItemMock).toHaveBeenCalledWith('ref-1');
        });

        it('reports an unknown reference id instead of claiming success', async () => {
            const result = (await tools.removeSubjectReference.execute({
                subjectId: 'subject-1',
                referenceId: 'made-up',
            })) as { error?: string };

            expect(result.error).toContain('Reference "made-up" not found');
            expect(result.error).toContain('getSubjectById');
            expect(deleteItemMock).not.toHaveBeenCalled();
        });

        it('refuses a reference that belongs to another subject', async () => {
            const result = (await tools.removeSubjectReference.execute({
                subjectId: 'subject-2',
                referenceId: 'ref-1',
            })) as { error?: string };

            expect(result.error).toContain('does not belong to subject "subject-2"');
            expect(deleteItemMock).not.toHaveBeenCalled();
        });

        it('reports an unknown subject', async () => {
            const result = await tools.removeSubjectReference.execute({
                subjectId: 'nope',
                referenceId: 'ref-1',
            });

            expect(result).toEqual({ error: 'Subject "nope" not found.' });
            expect(deleteItemMock).not.toHaveBeenCalled();
        });

        it('requires the subject id in its input schema', () => {
            const parsed = tools.removeSubjectReference.inputSchema.safeParse({
                referenceId: 'ref-1',
            });

            expect(parsed.success).toBe(false);
        });
    });
});
