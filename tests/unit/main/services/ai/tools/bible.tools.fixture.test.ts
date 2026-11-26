import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stepCountIs, streamText, tool } from 'ai';
import {
    createBibleFixture,
    removeBibleFixture,
    setActiveFixtureVersion,
} from '../../../../../helpers/bible-fixture';
import {
    callTool,
    createScriptedModel,
    promptToolResults,
    say,
    step,
} from '../../../../../helpers/mock-model';

const getInstalledLanguagesMock = vi.fn(() => ['fr', 'en']);
const createSubjectItemMock = vi.fn((..._args: unknown[]) => ({ id: 'item-1' }));

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
}));

vi.mock('@main/database/repositories/subjects.repository', () => ({
    exists: () => true,
    createItem: createSubjectItemMock,
}));

vi.mock(
    '@main/services/bible.service',
    async () => (await import('../../../../../helpers/bible-fixture')).fakeBibleService,
);

const { buildBibleTools } = await import('@main/services/ai/tools/bible.tools');

interface Verse {
    chapter: string;
    verse: string;
    content: string;
    bibleVersionAbbreviation: string;
}

interface PassageResult {
    error?: string;
    bibleVersionAbbreviation?: string;
    verseCount?: number;
    fromVerse?: string;
    toVerse?: string;
    hasMore?: boolean;
    nextFromVerse?: string;
    verses?: Verse[];
}

interface SearchResult {
    error?: string;
    bibleVersionAbbreviation?: string;
    total?: number;
    returned?: number;
    hasMore?: boolean;
    nextCursor?: string;
    results?: Verse[];
}

const tools = () => buildBibleTools('fr', 'lsg');

async function passage(input: Record<string, unknown>, built = tools()): Promise<PassageResult> {
    return (await built.getBiblePassage.execute(input)) as PassageResult;
}

async function search(input: Record<string, unknown>, built = tools()): Promise<SearchResult> {
    return (await built.searchBible.execute(input)) as SearchResult;
}

beforeAll(createBibleFixture);
afterAll(removeBibleFixture);
beforeEach(() => {
    vi.clearAllMocks();
    getInstalledLanguagesMock.mockReturnValue(['fr', 'en']);
    setActiveFixtureVersion('lsg');
});

describe('verse ranges', () => {
    const verses = (result: PassageResult) => result.verses?.map((verse) => verse.verse);

    it.each([
        [{ fromVerse: '16-18' }, ['16', '17', '18']],
        [{ fromVerse: '16 – 18' }, ['16', '17', '18']],
        [{ fromVerse: '16—17' }, ['16', '17']],
        [{ fromVerse: '16-18', toVerse: '18' }, ['16', '17', '18']],
        [{ fromVerse: '16', toVerse: '17' }, ['16', '17']],
        [{ fromVerse: 'v. 17' }, ['17']],
        [{ fromVerse: '17', toVerse: '17' }, ['17']],
        [{ fromVerse: '16', toVerse: '99' }, ['16', '17', '18']],
        [{ fromVerse: '', toVerse: '' }, ['16', '17', '18']],
        [{ chapter: 'chapitre 3', fromVerse: '18' }, ['18']],
    ])('reads %j', async (range, expected) => {
        expect(verses(await passage({ bookCode: 'Jean', chapter: '3', ...range }))).toEqual(
            expected,
        );
    });

    it.each([
        [{ chapter: '3-4' }, 'Give one chapter number'],
        [{ chapter: '' }, 'Invalid chapter'],
        [{ chapter: 'trois' }, 'Invalid chapter'],
        [{ chapter: '0' }, 'Invalid chapter'],
        [{ fromVerse: '16,18' }, 'Invalid verse number: "16,18"'],
        [{ fromVerse: '16-17-18' }, 'Invalid verse number'],
        [{ fromVerse: 'seize' }, 'Invalid verse number'],
        [{ fromVerse: '0' }, 'Verses start at 1'],
        [{ toVerse: '18' }, 'needs a fromVerse'],
        [{ fromVerse: '18', toVerse: '16' }, 'before it starts'],
        [{ fromVerse: '18-16' }, 'before it starts'],
        [{ fromVerse: '16-18', toVerse: '17' }, 'Send one range'],
        [{ fromVerse: '16', toVerse: '17-18' }, 'Invalid toVerse'],
    ])('rejects %j with a clear error', async (range, message) => {
        const result = await passage({ bookCode: 'Jean', chapter: '3', ...range });
        expect(result.error).toContain(message);
        expect(result.verses).toBeUndefined();
    });

    it('rejects a range in the subject tool too', async () => {
        const result = (await tools().addBibleReferenceToSubject.execute({
            subjectId: 's1',
            bookCode: 'Jean',
            chapter: '3-4',
            fromVerse: '16',
        })) as { error?: string };
        expect(result.error).toContain('Give one chapter number');
        expect(createSubjectItemMock).not.toHaveBeenCalled();
    });
});

describe('book names', () => {
    it.each(['J', '', ' '])('rejects the ambiguous book %j', async (bookCode) => {
        expect((await passage({ bookCode, chapter: '1' })).error).toContain('not found');
    });
});

describe('long chapters', () => {
    it('caps a whole chapter at 40 verses and says where to continue', async () => {
        const first = await passage({ bookCode: '19O', chapter: '119' });
        expect(first).toMatchObject({
            verseCount: 40,
            fromVerse: '1',
            toVerse: '40',
            hasMore: true,
            nextFromVerse: '41',
            nextToVerse: '60',
        });

        const second = await passage({
            bookCode: '19O',
            chapter: '119',
            fromVerse: first.nextFromVerse,
            toVerse: first.nextToVerse,
        });
        expect(second).toMatchObject({ verseCount: 20, fromVerse: '41', toVerse: '60' });
        expect(second).not.toHaveProperty('hasMore');
        expect(second).not.toHaveProperty('nextFromVerse');
    });

    it('caps a long range the same way', async () => {
        expect(
            await passage({ bookCode: '19O', chapter: '119', fromVerse: '5', toVerse: '50' }),
        ).toMatchObject({ verseCount: 40, toVerse: '44', nextFromVerse: '45', nextToVerse: '50' });
    });

    it('returns a short chapter whole, without paging fields', async () => {
        const result = await passage({ bookCode: 'Jean', chapter: '3' });
        expect(result.verseCount).toBe(3);
        expect(result).not.toHaveProperty('hasMore');
    });

    it('still saves the whole asked range to a subject', async () => {
        await tools().addBibleReferenceToSubject.execute({
            subjectId: 's1',
            bookCode: '19O',
            chapter: '119',
            fromVerse: '1',
            toVerse: '60',
        });
        const content = createSubjectItemMock.mock.calls[0][3] as string;
        expect(content).toContain('Psaumes 119:60');
    });
});

describe('searchBible through the AI loop', () => {
    it.each(["l'amour de Dieu", 'Saint-Esprit', 'Jean 3:16'])(
        'hands the model hits or an empty page for %s, never an error',
        async (query) => {
            const bibleTools = Object.fromEntries(
                Object.entries(tools()).map(([name, definition]) => [name, tool(definition)]),
            );
            const scripted = createScriptedModel([
                step([callTool('searchBible', { query })]),
                step([say('Voici les versets.')]),
            ]);

            const result = streamText({
                model: scripted.model,
                prompt: 'Cherche dans la Bible',
                tools: bibleTools,
                stopWhen: stepCountIs(3),
            });

            expect(await result.text).toBe('Voici les versets.');
            const [toolResult] = promptToolResults(scripted.calls[1].prompt);
            expect(toolResult.toolName).toBe('searchBible');
            expect(toolResult.output.type).toBe('json');
            const value = (toolResult.output as { value: SearchResult }).value;
            expect(value.error).toBeUndefined();
            expect(value.bibleVersionAbbreviation).toBe('lsg');
            if (query === 'Jean 3:16') {
                expect(value.total).toBe(0);
            } else {
                expect(value.total).toBeGreaterThan(0);
                expect(value.results?.[0].content).toMatch(/Saint-Esprit|amour de Dieu/);
            }
        },
    );
});
