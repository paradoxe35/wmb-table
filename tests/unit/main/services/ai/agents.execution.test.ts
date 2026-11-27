import { beforeEach, describe, expect, it, vi } from 'vitest';

const runSubAgentMock = vi.fn();
const getMessagesMock = vi.fn();

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('electron-updater', () => ({
    default: { autoUpdater: {} },
    autoUpdater: {},
}));

vi.mock('@main/database/repositories/ai.repository', () => ({
    getMessages: getMessagesMock,
}));

vi.mock('@main/services/ai/tools/sermon.tools', () => ({
    buildSermonTools: vi.fn(() => ({
        searchSermons: { description: 'search sermons', inputSchema: {}, execute: vi.fn() },
        searchContent: { description: 'search content', inputSchema: {}, execute: vi.fn() },
        getSermonContent: { description: 'get content', inputSchema: {}, execute: vi.fn() },
    })),
}));

vi.mock('@main/services/ai/tools/bible.tools', () => ({
    buildBibleTools: vi.fn(() => ({
        getBiblePassage: { description: 'get bible', inputSchema: {}, execute: vi.fn() },
        getBibleVersions: { description: 'get versions', inputSchema: {}, execute: vi.fn() },
        searchBible: { description: 'search bible', inputSchema: {}, execute: vi.fn() },
    })),
}));

vi.mock('@main/services/ai/tools/document.tools', () => ({
    buildDocumentTools: vi.fn(() => ({
        searchCustomDocuments: { description: 'search docs', inputSchema: {}, execute: vi.fn() },
        getCustomDocuments: { description: 'docs', inputSchema: {}, execute: vi.fn() },
        getCustomDocumentContent: { description: 'doc', inputSchema: {}, execute: vi.fn() },
    })),
}));

vi.mock('@main/database/repositories/custom-documents.repository', () => ({
    getCustomDocuments: vi.fn(),
    getCustomDocumentContent: vi.fn(),
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonListForLanguage: vi.fn(),
    getSermonMeta: vi.fn(),
    getTranslationsForSermon: vi.fn(),
    getTranslationsForSermonInLanguage: vi.fn(),
}));

vi.mock('@main/services/tantivy.service', () => ({
    getSermonParagraphs: vi.fn(),
    getInstalledLanguages: vi.fn().mockReturnValue(['fr']),
}));

vi.mock('@main/services/search.service', () => ({
    searchSermons: vi.fn(),
}));

vi.mock('@main/database/repositories/ai-bible.repository', () => ({
    getAvailableVersions: vi.fn(),
    getPassage: vi.fn(),
    searchVerses: vi.fn(),
}));

const { buildResearchAgentTool } = await import('@main/services/ai/agents/research-agent');
const { buildSermonReaderAgentTool } = await import('@main/services/ai/agents/sermon-reader-agent');

const SUB_AGENT_RESULT = { status: 'completed', response: 'Report', steps: 1, durationMs: 5 };

function context() {
    return { model: {} as never, contentLanguage: 'fr', uiLanguage: 'en' };
}

function taskOf(index: number) {
    return runSubAgentMock.mock.calls[index]?.[0];
}

describe('AI subagent execution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMessagesMock.mockReturnValue([]);
        runSubAgentMock.mockResolvedValue(SUB_AGENT_RESULT);
    });

    it('runs both agents through the shared sub-agent runner', async () => {
        const research = buildResearchAgentTool(context(), runSubAgentMock).researchTopic;
        const reader = buildSermonReaderAgentTool(context(), runSubAgentMock).readSermon;

        await expect(research.execute({ topic: 'faith' })).resolves.toEqual(SUB_AGENT_RESULT);
        await expect(reader.execute({ sermonId: '63-0318' })).resolves.toEqual(SUB_AGENT_RESULT);

        expect(runSubAgentMock.mock.calls.map(([task]) => [task.name, task.maxSteps])).toEqual([
            ['researchTopic', 50],
            ['readSermon', 20],
        ]);
        expect(Object.keys(runSubAgentMock.mock.calls[1][0].tools)).toEqual([
            'searchSermons',
            'getSermonContent',
            'searchContent',
        ]);
    });

    it('does not name a Bible version to the sermon reader, which has no Bible tools', async () => {
        await buildSermonReaderAgentTool(
            { ...context(), activeBibleVersion: 'lsg' },
            runSubAgentMock,
        ).readSermon.execute({ sermonId: '63-0318' });

        expect(taskOf(0).instructions).not.toContain('active Bible version');
    });

    it('does not auto-carry research findings without explicit alreadyKnown input', async () => {
        getMessagesMock.mockReturnValue([
            {
                id: 'assistant-prev',
                role: 'assistant',
                content: '',
                toolCalls: [
                    {
                        id: 'tool-1',
                        name: 'researchTopic',
                        input: { topic: 'Revelation 10' },
                    },
                ],
                toolResults: [
                    {
                        toolCallId: 'tool-1',
                        name: 'researchTopic',
                        output: {
                            status: 'completed',
                            response: 'Earlier research found references in multiple sermons.',
                        },
                    },
                ],
            },
        ]);
        const { researchTopic } = buildResearchAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
                dispatch: {
                    browserWindow: {} as never,
                    conversationId: 'conv-1',
                    generationId: 'gen-1',
                    assistantMessageId: 'assistant-1',
                },
            },
            runSubAgentMock,
        );
        await researchTopic.execute({
            topic: 'Revelation 10',
            followUpGoal: 'Find more references about the open book.',
        });

        const call = taskOf(0);
        expect(call.prompt).not.toContain('Already known from earlier research');
        expect(call.prompt).not.toContain('Earlier research found references in multiple sermons.');
    });

    it('lets readSermon resolve a sermon by query and uses broader reading mode for whole-sermon work', async () => {
        const { readSermon } = buildSermonReaderAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
            },
            runSubAgentMock,
        );
        await readSermon.execute({
            sermonQuery: 'Amour',
            question: 'Summarize the whole sermon and list Bible verses cited.',
        });

        const call = taskOf(0);
        expect(call.tools.searchSermons).toBeDefined();
        expect(call.prompt).toContain('Sermon to resolve first: Amour');
        expect(call.instructions).toContain('up to 8 pages (160 paragraphs)');
    });

    it('does not auto-carry sermon findings without explicit alreadyKnown input', async () => {
        getMessagesMock.mockReturnValue([
            {
                id: 'assistant-prev',
                role: 'assistant',
                content: '',
                toolCalls: [
                    {
                        id: 'tool-2',
                        name: 'readSermon',
                        input: { sermonId: '63-0318' },
                    },
                ],
                toolResults: [
                    {
                        toolCallId: 'tool-2',
                        name: 'readSermon',
                        output: {
                            status: 'completed',
                            response: 'Earlier reading covered the first section of the sermon.',
                        },
                    },
                ],
            },
        ]);
        const { readSermon } = buildSermonReaderAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
                dispatch: {
                    browserWindow: {} as never,
                    conversationId: 'conv-1',
                    generationId: 'gen-1',
                    assistantMessageId: 'assistant-1',
                },
            },
            runSubAgentMock,
        );
        await readSermon.execute({
            sermonId: '63-0318',
            question: 'Go deeper on the later paragraphs.',
            focus: 'Later paragraphs tied to Revelation 10.',
        });

        const call = taskOf(0);
        expect(call.prompt).not.toContain('Already known from prior reading');
        expect(call.prompt).not.toContain(
            'Earlier reading covered the first section of the sermon.',
        );
    });

    it('passes explicit alreadyKnown sermon context through to the prompt', async () => {
        const { readSermon } = buildSermonReaderAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
                dispatch: {
                    browserWindow: {} as never,
                    conversationId: 'conv-1',
                    generationId: 'gen-1',
                    assistantMessageId: 'assistant-1',
                },
            },
            runSubAgentMock,
        );
        await readSermon.execute({
            sermonId: '63-0318',
            question: 'Go deeper on the later paragraphs.',
            alreadyKnown: 'Earlier reading covered the first section of the sermon.',
            focus: 'Later paragraphs tied to Revelation 10.',
        });

        const call = taskOf(0);
        expect(call.prompt).toContain('Already known from prior reading');
        expect(call.prompt).toContain('Earlier reading covered the first section of the sermon.');
    });

    it('accepts pagination hints on readSermon and carries them into the task prompt', async () => {
        const { readSermon } = buildSermonReaderAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
            },
            runSubAgentMock,
        );

        expect(() =>
            readSermon.inputSchema.parse({
                sermonId: '63-0318',
                question: 'Continue from later in the sermon.',
                startParagraph: 40,
                maxParagraphs: 20,
            }),
        ).not.toThrow();

        await readSermon.execute({
            sermonId: '63-0318',
            question: 'Continue from later in the sermon.',
            startParagraph: 40,
            maxParagraphs: 20,
        });

        const call = taskOf(0);
        expect(call.prompt).toContain(
            'Pagination hint: start at paragraph 40 and read up to 20 paragraphs per page when useful.',
        );
    });

    it('falls back to focus when readSermon is called without a question', async () => {
        const { readSermon } = buildSermonReaderAgentTool(
            {
                model: {} as never,
                contentLanguage: 'fr',
                uiLanguage: 'en',
            },
            runSubAgentMock,
        );

        expect(() =>
            readSermon.inputSchema.parse({
                sermonId: '63-0318',
                focus: 'Continue from the later paragraphs about the Seals.',
            }),
        ).not.toThrow();

        await readSermon.execute({
            sermonId: '63-0318',
            focus: 'Continue from the later paragraphs about the Seals.',
        });

        const call = taskOf(0);
        expect(call.prompt).toContain(
            'Question to answer: Continue from the later paragraphs about the Seals.',
        );
    });
});
