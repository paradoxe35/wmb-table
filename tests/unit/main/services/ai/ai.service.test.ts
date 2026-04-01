import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
const ensureSettingsMock = vi.fn();
const getContentLanguageMock = vi.fn();

vi.mock('ai', () => ({
    generateText: generateTextMock,
}));

vi.mock('@main/database/repositories/ai.repository', () => ({
    ensureSettings: ensureSettingsMock,
    updateSettings: vi.fn(),
    trimConversationHistory: vi.fn(),
}));

vi.mock('@main/database/repositories/config.repository', () => ({
    getContentLanguage: getContentLanguageMock,
}));

vi.mock('@main/services/language-pack.service', () => ({
    getInstalledLanguages: vi.fn(),
}));

vi.mock('@main/ipc/register', () => ({
    sendToRenderer: vi.fn(),
}));

vi.mock('@main/services/bible.service', () => ({
    getActiveVersion: vi.fn(),
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
    buildAiTools: vi.fn(),
}));

vi.mock('@main/services/ai/context-memory', () => ({
    buildConversationContext: vi.fn(),
    calculateRemoteTokenBudget: vi.fn(),
}));

vi.mock('@main/services/ai/provider-resolver', () => ({
    resolveActiveModel: vi.fn(),
    resolveLanguageModel: vi.fn(),
}));

vi.mock('@main/services/ai/provider-catalog', () => ({
    getAiProviderCatalog: vi.fn(),
}));

vi.mock('@main/services/ai/model-fetcher', () => ({
    fetchProviderModels: vi.fn(),
    getModelContextWindow: vi.fn(),
}));

vi.mock('@main/services/ai/runners', () => ({
    GenerationRunnerImpl: class {},
}));

vi.mock('@main/services/ai/title-generator', () => ({
    shouldGenerateTitle: vi.fn(),
    generateConversationTitle: vi.fn(),
}));

vi.mock('@shared/constants', () => ({
    resolveUiLanguage: vi.fn(),
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
});
