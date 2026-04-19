import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
const getMessagesMock = vi.fn();

vi.mock('ai', () => ({
    generateText: generateTextMock,
    tool: vi.fn((definition) => definition),
    stepCountIs: vi.fn((steps: number) => steps),
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('electron-updater', () => ({
    default: { autoUpdater: {} },
    autoUpdater: {},
}));

vi.mock('@main/services/ai/agents/agent-dispatcher', () => ({
    dispatchAgentToolStart: vi.fn(),
    dispatchAgentToolComplete: vi.fn(),
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

describe('AI subagent execution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMessagesMock.mockReturnValue([]);
    });

    it('returns a truncation note for research agent output cut by length', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Research summary',
            finishReason: 'length',
            steps: [],
        });

        const { researchTopic } = buildResearchAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
        });
        const result = await researchTopic.execute({
            topic: 'faith',
        });

        expect(result).toEqual({
            status: 'completed',
            response: 'Research summary\n\n[Research output was truncated due to length limit]',
        });
    });

    it('returns a truncation note for sermon reader output cut by length', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'length',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
        });
        const result = await readSermon.execute({
            sermonId: '63-0318',
            question: 'What is said about the Seals?',
        });

        expect(result).toEqual({
            status: 'completed',
            response: 'Sermon summary\n\n[Sermon reading output was truncated due to length limit]',
        });
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
        generateTextMock.mockResolvedValueOnce({
            text: 'Research summary',
            finishReason: 'stop',
            steps: [],
        });

        const { researchTopic } = buildResearchAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
            dispatch: {
                browserWindow: {} as never,
                conversationId: 'conv-1',
                generationId: 'gen-1',
                assistantMessageId: 'assistant-1',
            },
        });
        await researchTopic.execute({
            topic: 'Revelation 10',
            followUpGoal: 'Find more references about the open book.',
        });

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.prompt).not.toContain('Already known from earlier research');
        expect(call.prompt).not.toContain('Earlier research found references in multiple sermons.');
    });

    it('lets readSermon resolve a sermon by query and uses broader reading mode for whole-sermon work', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'stop',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
        });
        await readSermon.execute({
            sermonQuery: 'Amour',
            question: 'Summarize the whole sermon and list Bible verses cited.',
        });

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.tools.searchSermons).toBeDefined();
        expect(call.prompt).toContain('Sermon to resolve first: Amour');
        expect(call.system).toContain('up to 8 pages (160 paragraphs)');
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
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'stop',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
            dispatch: {
                browserWindow: {} as never,
                conversationId: 'conv-1',
                generationId: 'gen-1',
                assistantMessageId: 'assistant-1',
            },
        });
        await readSermon.execute({
            sermonId: '63-0318',
            question: 'Go deeper on the later paragraphs.',
            focus: 'Later paragraphs tied to Revelation 10.',
        });

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.prompt).not.toContain('Already known from prior reading');
        expect(call.prompt).not.toContain(
            'Earlier reading covered the first section of the sermon.',
        );
    });

    it('passes explicit alreadyKnown sermon context through to the prompt', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'stop',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
            dispatch: {
                browserWindow: {} as never,
                conversationId: 'conv-1',
                generationId: 'gen-1',
                assistantMessageId: 'assistant-1',
            },
        });
        await readSermon.execute({
            sermonId: '63-0318',
            question: 'Go deeper on the later paragraphs.',
            alreadyKnown: 'Earlier reading covered the first section of the sermon.',
            focus: 'Later paragraphs tied to Revelation 10.',
        });

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.prompt).toContain('Already known from prior reading');
        expect(call.prompt).toContain('Earlier reading covered the first section of the sermon.');
    });

    it('accepts pagination hints on readSermon and carries them into the task prompt', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'stop',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
        });

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

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.prompt).toContain(
            'Pagination hint: start at paragraph 40 and read up to 20 paragraphs per page when useful.',
        );
    });

    it('falls back to focus when readSermon is called without a question', async () => {
        generateTextMock.mockResolvedValueOnce({
            text: 'Sermon summary',
            finishReason: 'stop',
            steps: [],
        });

        const { readSermon } = buildSermonReaderAgentTool({
            model: {} as never,
            contentLanguage: 'fr',
            uiLanguage: 'en',
        });

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

        const call = generateTextMock.mock.calls[0]?.[0];
        expect(call.prompt).toContain(
            'Question to answer: Continue from the later paragraphs about the Seals.',
        );
    });
});
