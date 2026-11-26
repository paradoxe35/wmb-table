import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText, stepCountIs, tool, type ToolSet } from 'ai';
import { createTestDb } from '../../../database/test-helpers';
import {
    callTool,
    createScriptedModel,
    promptToolResults,
    say,
    step,
} from '../../../../../helpers/mock-model';

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: () => ['fr'],
    searchSermons: vi.fn(async (_lang: string, _query: string, limit: number, offset: number) => ({
        hits: [1, 2, 3, 4, 5].slice(offset, offset + limit).map((date) => ({
            translationId: 1,
            tantivySermonDate: date,
            score: 10 - date,
            bestParagraphIndex: 1,
        })),
        total: 5,
        totalIsExact: true,
    })),
    getMatchingParagraphs: vi.fn(
        async (_lang: string, _query: string, _translationId: number, date: number) =>
            date === 2 ? [] : [{ paragraphIndex: date, snippet: `la foi ${date}` }],
    ),
}));

vi.mock('@main/database/repositories/reference.repository', () => ({
    tantivyDatesToSermonIds: (dates: number[]) =>
        new Map(dates.map((date) => [date, [`s-${date}`]] as const)),
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonMeta: (translationId: number, _lang: string, sermonId: string) => ({
        sermonId,
        translationId,
        title: `Sermon ${sermonId}`,
    }),
}));

const subjectsRepo = await import('@main/database/repositories/subjects.repository');
const notesRepo = await import('@main/database/repositories/notes.repository');
const { buildNoteTools } = await import('@main/services/ai/tools/note.tools');
const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
const { buildSubjectTools } = await import('@main/services/ai/tools/subject.tools');

function buildTools(): ToolSet {
    const definitions = {
        ...buildSermonTools('fr'),
        ...buildSubjectTools('fr'),
        ...buildNoteTools(),
    };
    return Object.fromEntries(
        Object.entries(definitions).map(([name, definition]) => [name, tool(definition)]),
    );
}

async function runScript(calls: Array<[string, unknown]>) {
    const scripted = createScriptedModel([
        ...calls.map(([name, input]) => step([callTool(name, input)])),
        step([say('Done.')]),
    ]);
    await generateText({
        model: scripted.model,
        prompt: 'go',
        tools: buildTools(),
        stopWhen: stepCountIs(calls.length + 1),
    });
    return scripted.calls
        .slice(1)
        .map((call) => promptToolResults(call.prompt).at(-1)?.output)
        .map((output) => (output && 'value' in output ? output.value : output));
}

function addReference(subjectId: string, title: string) {
    return subjectsRepo.createItem(
        subjectId,
        title,
        {
            kind: 'tree',
            documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
            tree: [],
        },
        'texte',
    );
}

describe('write tools driven by a scripted model', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('removes only a reference that exists in the named subject', async () => {
        const faith = subjectsRepo.create('La foi');
        const grace = subjectsRepo.create('La grâce');
        const reference = addReference(faith.id, 'Foi parfaite');

        const [unknown, wrongSubject, removed] = await runScript([
            ['removeSubjectReference', { subjectId: faith.id, referenceId: 'invented' }],
            ['removeSubjectReference', { subjectId: grace.id, referenceId: reference.id }],
            ['removeSubjectReference', { subjectId: faith.id, referenceId: reference.id }],
        ]);

        expect(unknown).toEqual({ error: expect.stringContaining('not found') });
        expect(wrongSubject).toEqual({ error: expect.stringContaining('does not belong') });
        expect(removed).toMatchObject({ success: true, documentTitle: 'Foi parfaite' });
        expect(subjectsRepo.getItems(faith.id)).toEqual([]);
    });

    it('keeps a formatted note and rewrites a plain one', async () => {
        const formatted = notesRepo.create('Tableau');
        notesRepo.updateContent(formatted.id, '<h1>Tableau</h1><table><tr><td>A</td></tr></table>');
        const plain = notesRepo.create('Simple');
        notesRepo.updateContent(plain.id, '<h1>Simple</h1><p>Ancien.</p>');

        const [refused, updated] = await runScript([
            ['updateNoteContent', { noteId: formatted.id, content: 'Nouveau' }],
            ['updateNoteContent', { noteId: plain.id, content: 'Nouveau' }],
        ]);

        expect(refused).toEqual({ error: expect.stringContaining('a table') });
        expect(notesRepo.getById(formatted.id)?.content).toContain('<table>');
        expect(updated).toEqual({ noteId: plain.id, name: 'Simple' });
        expect(notesRepo.getById(plain.id)?.content).toContain('<p>Nouveau</p>');
    });

    it('pages content search through the cursor without repeating a sermon', async () => {
        const [first] = await runScript([['searchContent', { query: 'la foi', limit: 2 }]]);
        const firstPage = first as { results: Array<{ sermonId: string }>; nextCursor: string };

        const [second] = await runScript([['searchContent', { cursor: firstPage.nextCursor }]]);
        const secondPage = second as { results: Array<{ sermonId: string }>; nextCursor: string };

        const [third] = await runScript([['searchContent', { cursor: secondPage.nextCursor }]]);
        const thirdPage = third as { results: Array<{ sermonId: string }>; hasMore: boolean };

        const ids = [firstPage, secondPage, thirdPage].flatMap((page) =>
            page.results.map((item) => item.sermonId),
        );
        expect(ids).toEqual(['s-1', 's-3', 's-4', 's-5']);
        expect(thirdPage.hasMore).toBe(false);
    });
});
