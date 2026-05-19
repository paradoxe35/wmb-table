import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
const ensureSettingsMock = vi.fn();
const getContentLanguageMock = vi.fn();
const getActiveBibleVersionAbbreviationMock = vi.fn();
const getInstalledLanguagesMock = vi.fn();
const getResolvedBibleVersionForLanguageMock = vi.fn();
const buildAiToolsMock = vi.fn();
const buildConversationContextMock = vi.fn();
const resolveActiveModelMock = vi.fn();
const resolveLanguageModelMock = vi.fn();
const getModelLimitsMock = vi.fn();
const resolveUiLanguageMock = vi.fn();
const calculateRemoteTokenBudgetMock = vi.fn();
const measurePromptTokensMock = vi.fn();
const measureToolTokensMock = vi.fn();
const getConversationMock = vi.fn();
const getRecentMessagesMock = vi.fn();
const createMessageMock = vi.fn();
const updateConversationMock = vi.fn();
const shouldGenerateTitleMock = vi.fn();
const generateConversationTitleMock = vi.fn();

vi.mock('ai', () => ({
    generateText: generateTextMock,
}));

vi.mock('@main/database/repositories/ai.repository', () => ({
    ensureSettings: ensureSettingsMock,
    updateSettings: vi.fn(),
    trimConversationHistory: vi.fn(),
    getConversation: getConversationMock,
    getRecentMessages: getRecentMessagesMock,
    createMessage: createMessageMock,
    updateConversation: updateConversationMock,
    syncMessage: vi.fn(),
    getMessages: vi.fn().mockReturnValue([]),
}));

vi.mock('@main/database/repositories/config.repository', () => ({
    getContentLanguage: getContentLanguageMock,
    getActiveBibleVersionAbbreviation: getActiveBibleVersionAbbreviationMock,
    getUiLanguage: vi.fn(),
}));

vi.mock('@main/services/language-pack.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
}));

vi.mock('@main/ipc/register', () => ({
    sendToRenderer: vi.fn(),
}));

vi.mock('@main/services/bible.service', () => ({
    getResolvedBibleVersionForLanguage: getResolvedBibleVersionForLanguageMock,
}));

vi.mock('@main/services/ai/local/local-model.service', () => ({
    scanLocalModels: vi.fn(),
}));

vi.mock('@main/services/ai/local/model-download.service', () => ({
    downloadLocalModel: vi.fn(),
}));

vi.mock('@main/services/ai/local/local-runtime.service', () => ({
    LocalRuntimeService: class {
        setGpuEnabled() {}
        dispose() {
            return Promise.resolve();
        }
    },
}));

vi.mock('@main/services/ai/tools', () => ({
    buildAiTools: buildAiToolsMock,
}));

vi.mock('@main/services/ai/context-memory', () => ({
    buildConversationContext: buildConversationContextMock,
}));

vi.mock('@main/services/ai/token-budget', () => ({
    calculateRemoteTokenBudget: calculateRemoteTokenBudgetMock,
    measurePromptTokens: measurePromptTokensMock,
    measureToolTokens: measureToolTokensMock,
    MIN_REMOTE_CONTEXT_WINDOW: 16_000,
}));

vi.mock('@main/services/ai/provider-resolver', () => ({
    resolveActiveModel: resolveActiveModelMock,
    resolveLanguageModel: resolveLanguageModelMock,
}));

vi.mock('@main/services/ai/provider-catalog', () => ({
    getAiProviderCatalog: vi.fn(),
}));

vi.mock('@main/services/ai/model-fetcher', () => ({
    fetchProviderModels: vi.fn(),
    getModelLimits: getModelLimitsMock,
}));

const runnerRunMock = vi.fn();
vi.mock('@main/services/ai/runners', () => ({
    GenerationRunnerImpl: class {
        constructor(_isLocal: boolean) {}
        run = runnerRunMock;
    },
}));

vi.mock('@main/services/ai/title-generator', () => ({
    shouldGenerateTitle: shouldGenerateTitleMock,
    generateConversationTitle: generateConversationTitleMock,
}));

vi.mock('@shared/constants', () => ({
    resolveUiLanguage: resolveUiLanguageMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { AiService } = await import('@main/services/ai/ai.service');

describe('AiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureSettingsMock.mockReturnValue({
            enabled: true,
            activeProvider: 'openai',
            languagePreference: 'active',
            maxHistoryConversations: 20,
            providers: {
                local: { enabled: true, model: null, gpuEnabled: false },
                openrouter: { enabled: true, model: 'openai/gpt-5-mini', apiKey: 'or-key' },
                openai: { enabled: true, model: 'gpt-5-mini', apiKey: 'oa-key' },
                gemini: { enabled: true, model: 'gemini-2.5-flash', apiKey: 'gm-key' },
                claude: { enabled: true, model: 'claude-haiku-4-5', apiKey: 'cl-key' },
            },
            customProviders: [],
        });
        getContentLanguageMock.mockReturnValue('fr');
        getActiveBibleVersionAbbreviationMock.mockReturnValue(undefined);
        getInstalledLanguagesMock.mockResolvedValue([]);
        getResolvedBibleVersionForLanguageMock.mockReturnValue({
            abbreviation: 'kjv',
            langCode: 'en',
        });
        resolveActiveModelMock.mockReturnValue('gpt-5-mini');
        resolveLanguageModelMock.mockReturnValue({ id: 'model' });
        resolveUiLanguageMock.mockReturnValue('en');
        getModelLimitsMock.mockResolvedValue({});
        buildAiToolsMock.mockReturnValue({
            searchContent: { description: 'search', inputSchema: { type: 'object' } },
        });
        measureToolTokensMock.mockReturnValue(321);
        measurePromptTokensMock.mockReturnValue(654);
        calculateRemoteTokenBudgetMock.mockReturnValue(4_000);
        buildConversationContextMock.mockReturnValue({
            recentMessages: [],
            summary: null,
        });
        runnerRunMock.mockImplementation(() => new Promise(() => {}));
        getRecentMessagesMock.mockReturnValue([]);
        shouldGenerateTitleMock.mockReturnValue(false);
        generateConversationTitleMock.mockResolvedValue(null);
        getConversationMock.mockReturnValue({
            id: 'conv-1',
            title: null,
        });
        createMessageMock
            .mockReturnValueOnce({
                id: 'user-1',
                conversationId: 'conv-1',
                role: 'user',
                content: 'hello world',
            })
            .mockReturnValueOnce({
                id: 'assistant-1',
                conversationId: 'conv-1',
                role: 'assistant',
                content: '',
            });
        updateConversationMock.mockImplementation((_id, updates) => ({
            id: 'conv-1',
            ...updates,
        }));
    });

    it('returns a concrete validation error when no content language is configured', async () => {
        getContentLanguageMock.mockReturnValue(null);
        const service = new AiService();

        const result = await service.testProvider({
            providerId: 'openai',
            model: 'gpt-5-mini',
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Aucune langue sélectionnée');
        expect(generateTextMock).not.toHaveBeenCalled();
    });

    it('does not persist queued user messages when send setup fails before generation can start', async () => {
        getContentLanguageMock.mockReturnValue(null);
        const service = new AiService();

        await expect(
            service.sendMessage({} as never, {
                conversationId: 'conv-1',
                messages: ['hello world', 'second message'],
                generationId: 'gen-1',
            }),
        ).rejects.toThrow('Aucune langue sélectionnée');

        expect(createMessageMock).not.toHaveBeenCalled();
        expect(runnerRunMock).not.toHaveBeenCalled();
    });

    it('omits delegation instructions for small remote context windows', async () => {
        getModelLimitsMock.mockResolvedValue({ contextWindow: 8_000 });
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).not.toContain('## Tool routing priority');
        expect(buildAiToolsMock).toHaveBeenCalledWith(
            'fr',
            expect.objectContaining({ isLocal: true }),
        );
    });

    it('disables delegation and agent tools when remote context window is unknown', async () => {
        getModelLimitsMock.mockResolvedValue({});
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).not.toContain('## Tool routing priority');
        expect(buildAiToolsMock).toHaveBeenCalledWith(
            'fr',
            expect.objectContaining({ isLocal: true }),
        );
    });

    it('keeps delegation instructions for larger remote context windows', async () => {
        getModelLimitsMock.mockResolvedValue({ contextWindow: 64_000 });
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).toContain('## Tool routing priority');
        expect(runArgs.systemPrompt).toContain(
            'When subagents are available, use them as the primary path for sermon-content research.',
        );
    });

    it('uses the Bible version resolved for the content language fallback, not only the active DB state', async () => {
        getResolvedBibleVersionForLanguageMock.mockReturnValue({
            abbreviation: 'kjv',
            langCode: 'en',
        });
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        expect(getResolvedBibleVersionForLanguageMock).toHaveBeenCalledWith('fr', undefined);

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).toContain('The user\'s active Bible version is "kjv"');
        expect(buildAiToolsMock).toHaveBeenCalledWith(
            'fr',
            expect.objectContaining({ activeBibleVersion: 'kjv' }),
        );
    });

    it('persists queued batches as separate user messages before the assistant run starts', async () => {
        createMessageMock.mockReset();
        createMessageMock
            .mockReturnValueOnce({
                id: 'user-1',
                conversationId: 'conv-1',
                role: 'user',
                content: 'second question',
            })
            .mockReturnValueOnce({
                id: 'user-2',
                conversationId: 'conv-1',
                role: 'user',
                content: 'third question',
            })
            .mockReturnValueOnce({
                id: 'assistant-1',
                conversationId: 'conv-1',
                role: 'assistant',
                content: '',
            });

        const service = new AiService();

        const result = await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['second question', 'third question'],
            generationId: 'gen-1',
        });

        expect(createMessageMock).toHaveBeenNthCalledWith(1, {
            conversationId: 'conv-1',
            role: 'user',
            content: 'second question',
        });
        expect(createMessageMock).toHaveBeenNthCalledWith(2, {
            conversationId: 'conv-1',
            role: 'user',
            content: 'third question',
        });
        expect(result.userMessages).toEqual([
            {
                id: 'user-1',
                conversationId: 'conv-1',
                role: 'user',
                content: 'second question',
            },
            {
                id: 'user-2',
                conversationId: 'conv-1',
                role: 'user',
                content: 'third question',
            },
        ]);
    });

    it('uses only the 20 most recent messages when generating a conversation title', async () => {
        runnerRunMock.mockResolvedValue(undefined);
        shouldGenerateTitleMock.mockReturnValue(true);
        getRecentMessagesMock.mockReturnValue(
            Array.from({ length: 20 }, (_, index) => ({
                id: `message-${index + 1}`,
                conversationId: 'conv-1',
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `message ${index + 1}`,
            })),
        );
        generateConversationTitleMock.mockResolvedValue('Recent title');

        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        expect(getRecentMessagesMock).toHaveBeenCalledWith('conv-1', 20);
        expect(generateConversationTitleMock).toHaveBeenCalledWith(
            { id: 'model' },
            'en',
            'fr',
            expect.arrayContaining([{ role: 'user', content: 'message 1' }]),
        );
    });
});
