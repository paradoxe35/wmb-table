import type { AiMessage, AiRunOutcome, AiToolEvent, AiToolResult } from '@shared/ai.types';
import { isToolErrorOutput } from '@shared/ai.types';
import { AI_DATA_EVENT } from '@renderer/utils/events';
import { createStore } from './create-store';

const TOOL_TO_EVENT: Record<string, string> = {
    createNote: AI_DATA_EVENT.notesChanged,
    updateNoteContent: AI_DATA_EVENT.notesChanged,
    editNote: AI_DATA_EVENT.notesChanged,
    appendToNote: AI_DATA_EVENT.notesChanged,
    createSubject: AI_DATA_EVENT.subjectsChanged,
    addSermonReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
    addBibleReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
    removeSubjectReference: AI_DATA_EVENT.subjectsChanged,
};

function updateMessage(
    messages: AiMessage[],
    messageId: string,
    update: (message: AiMessage) => AiMessage,
): AiMessage[] {
    return messages.map((message) => (message.id === messageId ? update(message) : message));
}

export function withToolCallStarted(messages: AiMessage[], event: AiToolEvent): AiMessage[] {
    return updateMessage(messages, event.messageId, (message) => ({
        ...message,
        toolCalls: [
            ...message.toolCalls,
            {
                id: event.toolCallId,
                name: event.toolName,
                input: (event.payload as Record<string, unknown>) ?? {},
            },
        ],
    }));
}

/** Sub-agent progress events carry no `isError`, only an `{ error }` payload. */
export function toolResultFromEvent(event: AiToolEvent): AiToolResult {
    return {
        toolCallId: event.toolCallId,
        name: event.toolName,
        output: event.payload,
        isError: event.isError ?? isToolErrorOutput(event.payload),
    };
}

export function withToolCallCompleted(
    messages: AiMessage[],
    result: AiToolResult,
    messageId: string,
) {
    return updateMessage(messages, messageId, (message) => ({
        ...message,
        toolResults: [...message.toolResults, result],
    }));
}

/** A failed write changed nothing, so the note and subject views have nothing to reload. */
export function dataEventForToolResult(result: AiToolResult): string | undefined {
    return result.isError ? undefined : TOOL_TO_EVENT[result.name];
}

interface AiRunOutcomeState {
    byMessageId: Record<string, AiRunOutcome>;
    record(messageId: string, outcome: AiRunOutcome): void;
}

export const useAiRunOutcomeStore = createStore<AiRunOutcomeState>()((set) => ({
    byMessageId: {},
    record: (messageId, outcome) =>
        set((state) => ({ byMessageId: { ...state.byMessageId, [messageId]: outcome } })),
}));
