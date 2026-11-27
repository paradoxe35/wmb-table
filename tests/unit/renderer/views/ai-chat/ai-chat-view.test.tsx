import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';

const chatState: Record<string, unknown> = {
    settings: null,
    conversations: [],
    conversationList: { hasMore: false },
    searchList: { hasMore: false },
    searchResults: null,
    activeConversationId: null,
    activeConversationRecord: null,
    conversationRuns: {},
    messagesByConversation: {},
    queuedMessagesByConversation: {},
    loadingConversations: {},
    loadingOlderConversations: {},
    historyByConversation: {},
    initialize: vi.fn(),
};

vi.mock('@renderer/stores', () => ({
    useAiChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@renderer/views/options/ai-chat/assistant-setup-card', () => ({
    default: () => <div data-testid="setup-card" />,
}));

for (const child of ['chat-conversation-list', 'chat-header', 'chat-input', 'chat-message-list']) {
    vi.doMock(`@renderer/views/options/ai-chat/${child}`, () => ({
        default: () => <div data-testid={child} />,
    }));
}

const { default: AiChatView } = await import('@renderer/views/options/ai-chat');

function renderWith(settings: AiSettings | null): string {
    chatState.settings = settings;
    return renderToStaticMarkup(<AiChatView />);
}

const configured: AiSettings = {
    ...createDefaultAiSettings(),
    activeProvider: 'mock-llm',
    customProviders: [
        {
            id: 'mock-llm',
            name: 'Mock LLM',
            baseUrl: 'http://127.0.0.1:1234/v1',
            defaultModel: 'mock-model',
        },
    ],
};

describe('AiChatView', () => {
    it('renders nothing until the settings are loaded', () => {
        expect(renderWith(null)).toBe('');
    });

    it('shows the setup card when no provider is configured', () => {
        const html = renderWith(createDefaultAiSettings());
        expect(html).toContain('setup-card');
        expect(html).not.toContain('chat-input');
    });

    it('shows the setup card when the provider still needs a key', () => {
        const html = renderWith({ ...createDefaultAiSettings(), activeProvider: 'openai' });
        expect(html).toContain('setup-card');
    });

    it('shows the chat once a provider is configured', () => {
        const html = renderWith(configured);
        expect(html).toContain('chat-input');
        expect(html).not.toContain('setup-card');
    });

    it('shows the chat for an old profile that turned the assistant off', () => {
        const html = renderWith({ ...configured, enabled: false });
        expect(html).toContain('chat-input');
        expect(html).not.toContain('setup-card');
    });
});
