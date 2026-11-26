// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import i18n from '@renderer/i18n';
import ChatInput from '@renderer/views/options/ai-chat/chat-input';

type Props = ComponentProps<typeof ChatInput>;

function renderInput(overrides: Partial<Props> = {}) {
    const props: Props = {
        draft: 'Qui t’a dit que tu étais nu ?',
        sending: false,
        runStatus: null,
        queuedMessages: [],
        conversationId: 'conv-1',
        completionCount: 0,
        lastCompletedConversationId: null,
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStop: vi.fn(),
        onRemoveQueuedMessage: vi.fn(),
        onResendQueue: vi.fn(),
        ...overrides,
    };
    render(<ChatInput {...props} />);
    return props;
}

function pressEnter(init: KeyboardEventInit & { keyCode?: number } = {}) {
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', keyCode: 13, ...init });
}

describe('ChatInput', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('fr');
    });

    it('sends on Enter', () => {
        const props = renderInput();

        pressEnter();

        expect(props.onSend).toHaveBeenCalledTimes(1);
    });

    it('keeps Shift+Enter for a new line', () => {
        const props = renderInput();

        pressEnter({ shiftKey: true });

        expect(props.onSend).not.toHaveBeenCalled();
    });

    it('does not send while an input method is composing a word', () => {
        const props = renderInput();

        pressEnter({ isComposing: true, keyCode: 229 });
        pressEnter({ isComposing: true });

        expect(props.onSend).not.toHaveBeenCalled();
    });

    it('names the Stop button and greys it out while stopping', () => {
        renderInput({ sending: true, runStatus: 'stopping' });

        const stop = screen.getByRole('button', { name: 'Arrêter' }) as HTMLButtonElement;
        expect(stop.disabled).toBe(true);
    });

    it('offers to send a queue that is stuck after a failed send', () => {
        const props = renderInput({ queuedMessages: [{ id: 'q1', content: 'Saint-Esprit' }] });

        fireEvent.click(screen.getByRole('button', { name: /Renvoyer/ }));

        expect(props.onResendQueue).toHaveBeenCalledTimes(1);
    });

    it('does not offer to resend while the answer is still running', () => {
        renderInput({
            sending: true,
            runStatus: 'streaming',
            queuedMessages: [{ id: 'q1', content: 'Saint-Esprit' }],
        });

        expect(screen.queryByRole('button', { name: /Renvoyer/ })).toBeNull();
    });
});
