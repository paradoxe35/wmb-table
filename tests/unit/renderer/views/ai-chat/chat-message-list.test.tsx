// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@shared/ai.types';
import type { AiRunNotice } from '@renderer/stores/ai-chat/chat-state';
import i18n from '@renderer/i18n';
import ChatMessageList from '@renderer/views/options/ai-chat/chat-message-list';

function message(id: string, role: AiMessage['role'], content: string): AiMessage {
    return {
        id,
        conversationId: 'conv-1',
        role,
        content,
        toolCalls: [],
        toolResults: [],
        createdAt: '2026-11-26T10:00:00.000Z',
    };
}

function renderList(
    messages: AiMessage[],
    runNotice: AiRunNotice | null,
    activeAssistantMessageId: string | null = null,
) {
    return render(
        <App>
            <ChatMessageList
                conversationId="conv-1"
                messages={messages}
                sending={activeAssistantMessageId !== null}
                activeAssistantMessageId={activeAssistantMessageId}
                hasQueuedMessages={false}
                queuedMessageCount={0}
                loading={false}
                loadingOlder={false}
                hasMoreHistory={false}
                runNotice={runNotice}
                onLoadOlderMessages={vi.fn(async () => {})}
                onQuickStart={vi.fn()}
            />
        </App>,
    );
}

const question = message('u1', 'user', 'Qui t’a dit que tu étais nu ?');

describe('ChatMessageList outcome banners', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('fr');
    });

    it('puts the banner inside the answer it describes', () => {
        const { container } = renderList(
            [question, message('a1', 'assistant', 'Une réponse coupée')],
            { kind: 'truncated', messageId: 'a1' },
        );

        const answer = [...container.querySelectorAll('.ai-chat__bubble--assistant')].pop();
        expect(answer?.querySelector('.ai-chat__run-notice')?.textContent).toMatch(
            /^Réponse coupée/,
        );
        expect(container.querySelector('.ai-chat__notice-row')).toBeNull();
    });

    it('shows the banner under the thread when the failed answer has no text', () => {
        const { container } = renderList([question], {
            kind: 'error',
            messageId: 'a1',
            code: 'auth',
            retryable: false,
            detail: 'Incorrect API key provided',
        });

        expect(container.querySelector('.ai-chat__notice-row')?.textContent).toContain(
            'Clé API refusée',
        );
        expect(screen.getAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);
    });

    it('keeps the small retry button on the question when there is no banner', () => {
        const { container } = renderList([question], null);

        expect(container.querySelector('.ai-chat__bubble-actions .ai-chat__retry-button')).not.toBe(
            null,
        );
    });

    it('shows a typing indicator made of dots, not a spinner glyph, while text streams', () => {
        const { container } = renderList(
            [question, message('a1', 'assistant', 'Je vais chercher.')],
            null,
            'a1',
        );

        const indicator = container.querySelector('.ai-chat__typing-indicator');
        expect(indicator?.getAttribute('aria-label')).toBe('Réponse en cours');
        expect(indicator?.querySelector('.anticon')).toBeNull();
        expect(indicator?.textContent).toBe('');
    });
});
