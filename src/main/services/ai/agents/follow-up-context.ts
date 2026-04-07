import * as aiRepo from '@main/database/repositories/ai.repository';
import type { AiToolCall, AiToolResult } from '@shared/ai.types';

const AUTO_CONTEXT_CHAR_LIMIT = 1_200;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeKey(value: string | undefined): string {
    return normalizeWhitespace(String(value ?? '')).toLowerCase();
}

function truncate(value: string, maxChars: number): string {
    return value.length <= maxChars
        ? value
        : `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function extractSummary(result: AiToolResult): string | undefined {
    const output = result.output;
    if (!output || typeof output !== 'object') return undefined;

    const status = 'status' in output ? output.status : undefined;
    if (status === 'failed') return undefined;

    const summary = 'summary' in output ? output.summary : undefined;
    if (typeof summary !== 'string') return undefined;

    const normalized = normalizeWhitespace(summary);
    return normalized ? truncate(normalized, AUTO_CONTEXT_CHAR_LIMIT) : undefined;
}

function getToolCallForResult(
    toolCalls: AiToolCall[],
    result: AiToolResult,
): AiToolCall | undefined {
    return toolCalls.find((toolCall) => toolCall.id === result.toolCallId);
}

function getLatestMatchingSummary(
    conversationId: string | undefined,
    toolName: string,
    matcher?: (toolCall: AiToolCall | undefined) => boolean,
): string | undefined {
    if (!conversationId) return undefined;

    const messages = aiRepo
        .getMessages(conversationId)
        .filter((message) => message.role === 'assistant' && message.toolResults.length > 0);

    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
        const message = messages[messageIndex];
        for (let resultIndex = message.toolResults.length - 1; resultIndex >= 0; resultIndex -= 1) {
            const result = message.toolResults[resultIndex];
            if (result.name !== toolName || result.isError) continue;

            const toolCall = getToolCallForResult(message.toolCalls, result);
            if (matcher && !matcher(toolCall)) continue;

            const summary = extractSummary(result);
            if (summary) return summary;
        }
    }

    return undefined;
}

export function getAutoSermonAlreadyKnown(input: {
    conversationId?: string;
    sermonId?: string;
    sermonQuery?: string;
    alreadyKnown?: string;
    focus?: string;
}): string | undefined {
    if (input.alreadyKnown?.trim()) return input.alreadyKnown.trim();

    const normalizedSermonId = normalizeKey(input.sermonId);
    const normalizedSermonQuery = normalizeKey(input.sermonQuery);
    if (!input.focus?.trim() || (!normalizedSermonId && !normalizedSermonQuery)) {
        return undefined;
    }

    const summary = getLatestMatchingSummary(input.conversationId, 'readSermon', (toolCall) => {
        const toolInput = (toolCall?.input ?? {}) as Record<string, unknown>;
        const priorSermonId = normalizeKey(
            typeof toolInput.sermonId === 'string' ? toolInput.sermonId : undefined,
        );
        const priorSermonQuery = normalizeKey(
            typeof toolInput.sermonQuery === 'string' ? toolInput.sermonQuery : undefined,
        );

        if (normalizedSermonId && priorSermonId) {
            return normalizedSermonId === priorSermonId;
        }

        if (normalizedSermonQuery && priorSermonQuery) {
            return normalizedSermonQuery === priorSermonQuery;
        }

        return false;
    });

    return summary ? `Prior sermon findings carried over automatically:\n${summary}` : undefined;
}
