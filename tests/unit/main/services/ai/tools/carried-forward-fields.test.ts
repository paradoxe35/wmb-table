import { describe, expect, it } from 'vitest';
import { buildBibleTools } from '@main/services/ai/tools/bible.tools';
import { buildDocumentTools } from '@main/services/ai/tools/document.tools';
import { buildNoteTools } from '@main/services/ai/tools/note.tools';
import { buildSermonTools } from '@main/services/ai/tools/sermon.tools';
import { buildSubjectTools } from '@main/services/ai/tools/subject.tools';

/**
 * A model answers by carrying a tool result into the next call, so it sends back the field
 * names the results gave it. Every payload here is written the way a result names things:
 * if a tool stops accepting one, that whole follow-up stops working in production.
 */
const CARRIED_FORWARD: Array<[string, Record<string, unknown>]> = [
    [
        'getBiblePassage',
        {
            bookCode: '46N',
            chapter: '7',
            fromVerse: '10',
            toVerse: '16',
            bibleVersionAbbreviation: 'lsg',
            languageCode: 'fr',
        },
    ],
    ['searchBible', { query: 'la foi', bibleVersionAbbreviation: 'lsg', languageCode: 'fr' }],
    [
        'addBibleReferenceToSubject',
        {
            subjectId: 'subject-1',
            bookCode: '43N',
            chapter: '3',
            fromVerse: '16',
            bibleVersionAbbreviation: 'lsg',
        },
    ],
    [
        'addSermonReferenceToSubject',
        {
            subjectId: 'subject-1',
            sermonId: '65-0801',
            translationId: 7,
            languageCode: 'fr',
            paragraphNumber: 133,
        },
    ],
    ['getSermonContent', { sermonId: '65-0801', translationId: 7, languageCode: 'fr' }],
    ['searchContent', { query: 'la foi', languageCode: 'fr', mode: 'exact' }],
    ['searchSermons', { query: 'la foi', languageCode: 'fr' }],
    ['getCustomDocumentContent', { documentId: 'doc-1' }],
    ['getNoteById', { noteId: 'note-1' }],
    ['getSubjectById', { subjectId: 'subject-1' }],
    ['removeSubjectReference', { referenceId: 'ref-1' }],
];

/**
 * One name per concept: a second spelling would be one more thing for a model to get wrong,
 * so the names these tools used to take are gone rather than kept as aliases.
 */
const RETIRED_SPELLING: Array<[string, Record<string, unknown>]> = [
    ['getBiblePassage', { book: 'Jean', chapter: '3' }],
    ['addBibleReferenceToSubject', { subjectId: 's', book: 'Jean', chapter: '3', fromVerse: '16' }],
    ['addSermonReferenceToSubject', { subjectId: 's', sermonId: '65-0801', paragraphIndex: 133 }],
];

const tools: Record<string, { inputSchema: { safeParse: (value: unknown) => any } }> = {
    ...buildDocumentTools(),
    ...buildBibleTools('fr', 'lsg'),
    ...buildSermonTools('fr'),
    ...buildSubjectTools('fr'),
    ...buildNoteTools(),
};

function parse(toolName: string, payload: Record<string, unknown>) {
    const definition = tools[toolName];
    expect(definition, `tool ${toolName} is missing`).toBeDefined();
    return definition.inputSchema.safeParse(payload);
}

describe('tool inputs accept the names their own results use', () => {
    it.each(CARRIED_FORWARD)('%s accepts a payload carried over from a result', (name, payload) => {
        const result = parse(name, payload);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it.each(RETIRED_SPELLING)(
        '%s no longer takes a second name for the same thing',
        (name, payload) => {
            expect(parse(name, payload).success).toBe(false);
        },
    );
});
