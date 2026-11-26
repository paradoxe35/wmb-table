import type { AiMessage } from '@shared/ai.types';

function canRetryUserMessageAtIndex(messages: AiMessage[], index: number): boolean {
    const message = messages[index];
    if (!message || message.role !== 'user') {
        return false;
    }

    return messages
        .slice(index + 1)
        .every((following) => following.role === 'assistant' && !following.content.trim());
}

export function isEmptyAssistantMessage(message: AiMessage | undefined): boolean {
    return Boolean(message && message.role === 'assistant' && !message.content.trim());
}

function findRetryableUserMessageIdForEmptyAssistant(
    messages: AiMessage[],
    index: number,
): string | null {
    if (!isEmptyAssistantMessage(messages[index])) {
        return null;
    }

    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (messages[cursor].role !== 'user') {
            continue;
        }

        return canRetryUserMessageAtIndex(messages, cursor) ? messages[cursor].id : null;
    }

    return null;
}

/** The user message a bubble's retry button resends, if it may show one. */
export function resolveRetryUserMessageId(
    messages: AiMessage[],
    index: number,
    lastMessageId: string | null,
): string | null {
    const message = messages[index];
    if (!message) {
        return null;
    }

    if (message.role === 'user') {
        return message.id === lastMessageId ? message.id : null;
    }

    return findRetryableUserMessageIdForEmptyAssistant(messages, index);
}

/** The last user message, when no answer text follows it yet, so main can run it again. */
export function findLastRetryableUserMessageId(messages: AiMessage[]): string | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') {
            return canRetryUserMessageAtIndex(messages, index) ? messages[index].id : null;
        }
    }

    return null;
}
