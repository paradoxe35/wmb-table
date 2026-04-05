import { describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();

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
            summary: 'Research summary\n\n[Research output was truncated due to length limit]',
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
            summary: 'Sermon summary\n\n[Sermon reading output was truncated due to length limit]',
        });
    });
});
