// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';

let resolveSend: (accepted: boolean) => void = () => {};
const sendMessage = vi.fn(
    () =>
        new Promise<boolean>((resolve) => {
            resolveSend = resolve;
        }),
);

const settings: AiSettings = {
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

const chatState: Record<string, unknown> = {
    settings,
    conversations: [],
    conversationList: { hasMore: false },
    searchList: { hasMore: false },
    searchResults: null,
    activeConversationId: null,
    activeConversationRecord: null,
    conversationRuns: {},
    messagesByConversation: {},
    queuedMessagesByConversation: {},
    runNoticeByConversation: {},
    loadingConversations: {},
    loadingOlderConversations: {},
    historyByConversation: {},
    initialize: vi.fn(),
    sendMessage,
};

vi.mock('@renderer/stores', () => ({
    useAiChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@renderer/views/options/ai-chat/chat-input', () => ({
    default: (props: { draft: string; onDraftChange(value: string): void; onSend(): void }) => (
        <>
            <textarea
                aria-label="message"
                value={props.draft}
                onChange={(event) => props.onDraftChange(event.target.value)}
            />
            <button onClick={props.onSend}>send</button>
        </>
    ),
}));

for (const child of ['chat-conversation-list', 'chat-header', 'chat-message-list']) {
    vi.doMock(`@renderer/views/options/ai-chat/${child}`, () => ({
        default: () => <div data-testid={child} />,
    }));
}

const { default: AiChatView } = await import('@renderer/views/options/ai-chat');

function field(): HTMLTextAreaElement {
    return screen.getByLabelText('message') as HTMLTextAreaElement;
}

async function sendAndRefuse(typedMeanwhile: string): Promise<void> {
    render(<AiChatView />);
    fireEvent.change(field(), { target: { value: "l'amour" } });
    fireEvent.click(screen.getByText('send'));
    if (typedMeanwhile) fireEvent.change(field(), { target: { value: typedMeanwhile } });
    await act(async () => resolveSend(false));
}

describe('AiChatView send', () => {
    it('puts a refused message back in the empty field', async () => {
        await sendAndRefuse('');

        expect(field().value).toBe("l'amour");
    });

    it('keeps both the refused message and what the user typed meanwhile', async () => {
        await sendAndRefuse('Saint-Esprit');

        expect(field().value).toBe("l'amour\nSaint-Esprit");
    });
});
