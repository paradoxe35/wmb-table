// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWmbLink } from '@shared/wmb-link';
import type { AiMessage } from '@shared/ai.types';
import i18n from '@renderer/i18n';
import { useAiChatStore } from '@renderer/stores/ai-chat.store';

const navigate = vi.fn();
vi.mock('@renderer/hooks/use-wmb-link', () => ({
    parseWmbLink,
    useWmbLinkNavigate: () => navigate,
}));

const { default: AiReferenceLink } =
    await import('@renderer/views/options/ai-chat/ai-reference-link');
const { MessageBubble } = await import('@renderer/views/options/ai-chat/message-bubble');
const { default: ChatConversationList } =
    await import('@renderer/views/options/ai-chat/chat-conversation-list');

const SERMON_LINK = 'wmb://sermon/63-0318/fr/1/12';

const answer: AiMessage = {
    id: 'a1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'Une réponse',
    toolCalls: [],
    toolResults: [],
    createdAt: '2026-11-26T10:00:00.000Z',
};

describe('keyboard access in the chat', () => {
    beforeEach(async () => {
        navigate.mockReset();
        await i18n.changeLanguage('fr');
    });

    it('lets a reference tag be reached with Tab and followed with Enter', () => {
        render(<AiReferenceLink href={SERMON_LINK}>63-0318 §12</AiReferenceLink>);
        const reference = screen.getByRole('link', { name: '63-0318 §12' });

        expect(reference.tabIndex).toBe(0);
        fireEvent.keyDown(reference, { key: 'Enter' });

        expect(navigate).toHaveBeenCalledWith(SERMON_LINK);
    });

    it('ignores other keys on a reference tag', () => {
        render(<AiReferenceLink href={SERMON_LINK}>63-0318 §12</AiReferenceLink>);

        fireEvent.keyDown(screen.getByRole('link'), { key: 'a' });

        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens and closes the reasoning with a real button that reports its state', () => {
        useAiChatStore.setState({ reasoningByMessage: { a1: 'Je cherche d’abord.' } });
        render(
            <App>
                <MessageBubble
                    conversationId="conv-1"
                    message={answer}
                    isActive={false}
                    retryUserMessageId={null}
                    notice={null}
                />
            </App>,
        );
        const toggle = screen.getByRole('button', { name: /Voir le raisonnement/ });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);

        expect(
            screen
                .getByRole('button', { name: /Masquer le raisonnement/ })
                .getAttribute('aria-expanded'),
        ).toBe('true');
        expect(screen.getByText('Je cherche d’abord.')).toBeTruthy();
    });

    it('keeps message bubbles out of the Tab order', () => {
        const { container } = render(
            <App>
                <MessageBubble
                    conversationId="conv-1"
                    message={answer}
                    isActive={false}
                    retryUserMessageId={null}
                    notice={null}
                />
            </App>,
        );

        const focusable = container.querySelectorAll('[tabindex="0"]');
        expect(focusable.length).toBe(0);
    });

    it('names the menu button of each conversation', async () => {
        await i18n.changeLanguage('en');
        render(
            <App>
                <ChatConversationList
                    conversations={[
                        {
                            id: 'conv-1',
                            title: 'Genèse 3',
                            summary: null,
                            aiTitle: false,
                            createdAt: '2026-11-26T10:00:00.000Z',
                            updatedAt: '2026-11-26T10:00:00.000Z',
                        },
                    ]}
                    activeConversationId="conv-1"
                    streamingConversations={{}}
                    loading={false}
                    loadingOlder={false}
                    hasMore={false}
                    searchTerm=""
                    isSearching={false}
                    onSearchChange={vi.fn()}
                    onCreateConversation={vi.fn()}
                    onLoadOlderConversations={vi.fn()}
                    onSelectConversation={vi.fn()}
                    onRenameConversation={vi.fn()}
                    onExportConversation={vi.fn()}
                    onDeleteConversation={vi.fn()}
                    onClearConversations={vi.fn()}
                    hasStreamingConversations={false}
                />
            </App>,
        );

        expect(screen.getByRole('button', { name: 'Conversation actions' })).toBeTruthy();
    });
});
