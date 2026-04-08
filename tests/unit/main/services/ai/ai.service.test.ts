import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
const ensureSettingsMock = vi.fn();
const getContentLanguageMock = vi.fn();
const getInstalledLanguagesMock = vi.fn();
const getActiveVersionMock = vi.fn();
const buildAiToolsMock = vi.fn();
const buildConversationContextMock = vi.fn();
const resolveActiveModelMock = vi.fn();
const resolveLanguageModelMock = vi.fn();
const getModelContextWindowMock = vi.fn();
const resolveUiLanguageMock = vi.fn();
const calculateRemoteTokenBudgetMock = vi.fn();
const measurePromptTokensMock = vi.fn();
const measureToolTokensMock = vi.fn();
const getConversationMock = vi.fn();
const createMessageMock = vi.fn();
const updateConversationMock = vi.fn();

vi.mock('ai', () => ({
    generateText: generateTextMock,
}));

vi.mock('@main/database/repositories/ai.repository', () => ({
    ensureSettings: ensureSettingsMock,
    updateSettings: vi.fn(),
    trimConversationHistory: vi.fn(),
    getConversation: getConversationMock,
    createMessage: createMessageMock,
    updateConversation: updateConversationMock,
    syncMessage: vi.fn(),
    getMessages: vi.fn().mockReturnValue([]),
}));

vi.mock('@main/database/repositories/config.repository', () => ({
    getContentLanguage: getContentLanguageMock,
    getUiLanguage: vi.fn(),
}));

vi.mock('@main/services/language-pack.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
}));

vi.mock('@main/ipc/register', () => ({
    sendToRenderer: vi.fn(),
}));

vi.mock('@main/services/bible.service', () => ({
    getActiveVersion: getActiveVersionMock,
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
    getModelContextWindow: getModelContextWindowMock,
}));

const runnerRunMock = vi.fn();
vi.mock('@main/services/ai/runners', () => ({
    GenerationRunnerImpl: class {
        constructor(_isLocal: boolean) {}
        run = runnerRunMock;
    },
}));

vi.mock('@main/services/ai/title-generator', () => ({
    shouldGenerateTitle: vi.fn(),
    generateConversationTitle: vi.fn(),
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
        getInstalledLanguagesMock.mockResolvedValue([]);
        getActiveVersionMock.mockReturnValue({ abbreviation: 'kjv' });
        resolveActiveModelMock.mockReturnValue('gpt-5-mini');
        resolveLanguageModelMock.mockReturnValue({ id: 'model' });
        resolveUiLanguageMock.mockReturnValue('en');
        getModelContextWindowMock.mockResolvedValue(undefined);
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

    it('omits delegation instructions for small remote context windows', async () => {
        getModelContextWindowMock.mockResolvedValue(8_000);
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).not.toContain('## Delegation to subagents');
    });

    it('keeps delegation instructions for larger remote context windows', async () => {
        getModelContextWindowMock.mockResolvedValue(64_000);
        const service = new AiService();

        await service.sendMessage({} as never, {
            conversationId: 'conv-1',
            messages: ['hello world'],
            generationId: 'gen-1',
        });

        const runArgs = runnerRunMock.mock.calls[0]?.[0];
        expect(runArgs.systemPrompt).toContain('## Delegation to subagents');
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
});
