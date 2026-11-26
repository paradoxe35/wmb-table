import { pruneMessages, type ModelMessage } from 'ai';
import { estimateTokenCount } from 'tokenx';
import { summarizeToolResult } from '../tool-result-summary';

type ToolMessage = Extract<ModelMessage, { role: 'tool' }>;
type ToolContentPart = ToolMessage['content'][number];
type ToolResultOutput = Extract<ToolContentPart, { type: 'tool-result' }>['output'];

const MESSAGE_OVERHEAD_TOKENS = 4;
const CONDENSED_MARKER = '[Condensed earlier result]';
const CONDENSED_CHAR_LIMIT = 600;
/** Older tool calls are dropped only outside the latest exchange, so the model keeps its
 * current thread of research. */
const KEPT_RECENT_MESSAGES = 4;

export function estimateMessagesTokens(messages: ModelMessage[]): number {
    return messages.reduce(
        (sum, message) =>
            sum +
            MESSAGE_OVERHEAD_TOKENS +
            estimateTokenCount(
                typeof message.content === 'string'
                    ? message.content
                    : JSON.stringify(message.content),
            ),
        0,
    );
}

function outputValue(output: ToolResultOutput): unknown {
    if (output.type === 'json') return output.value;
    if (output.type !== 'text') return output;
    try {
        return JSON.parse(output.value);
    } catch {
        return output.value;
    }
}

function isCondensed(output: ToolResultOutput): boolean {
    return output.type === 'text' && output.value.startsWith(CONDENSED_MARKER);
}

function condensePart(part: ToolContentPart): ToolContentPart {
    if (part.type !== 'tool-result' || isCondensed(part.output)) return part;
    if (part.output.type !== 'json' && part.output.type !== 'text') return part;

    const summary = summarizeToolResult(
        { toolCallId: part.toolCallId, name: part.toolName, output: outputValue(part.output) },
        CONDENSED_CHAR_LIMIT,
    );
    return {
        ...part,
        output: {
            type: 'text',
            value: `${CONDENSED_MARKER} ${summary}. Call the tool again if the exact text is needed.`,
        },
    };
}

/** Replaces tool outputs with short summaries (counts, ids, top hits), except in the latest
 * `keepLatest` tool messages. */
export function condenseToolResults(messages: ModelMessage[], keepLatest: number): ModelMessage[] {
    const toolIndexes = messages.flatMap((message, index) =>
        message.role === 'tool' ? [index] : [],
    );
    const condensed = new Set(toolIndexes.slice(0, Math.max(0, toolIndexes.length - keepLatest)));

    return messages.map((message, index) =>
        message.role === 'tool' && condensed.has(index)
            ? { ...message, content: message.content.map(condensePart) }
            : message,
    );
}

const SHRINK_STAGES: ((messages: ModelMessage[]) => ModelMessage[])[] = [
    (messages) => pruneMessages({ messages, reasoning: 'before-last-message' }),
    (messages) => condenseToolResults(messages, 1),
    (messages) =>
        pruneMessages({ messages, toolCalls: `before-last-${KEPT_RECENT_MESSAGES}-messages` }),
    (messages) => condenseToolResults(messages, 0),
];

/** A tool call left without a result (a stopped or refused step) makes providers reject the
 * whole request, so it is removed before the messages are sent again. */
export function withoutUnansweredToolCalls(messages: ModelMessage[]): ModelMessage[] {
    const answered = new Set(
        messages.flatMap((message) =>
            message.role === 'tool'
                ? message.content.flatMap((part) =>
                      part.type === 'tool-result' ? [part.toolCallId] : [],
                  )
                : [],
        ),
    );

    return messages
        .map((message) =>
            message.role === 'assistant' && typeof message.content !== 'string'
                ? {
                      ...message,
                      content: message.content.filter(
                          (part) => part.type !== 'tool-call' || answered.has(part.toolCallId),
                      ),
                  }
                : message,
        )
        .filter((message) => typeof message.content === 'string' || message.content.length > 0);
}

/** Applies the cheapest reductions first and stops as soon as the prompt fits. */
export function shrinkMessages(
    messages: ModelMessage[],
    fits: (candidate: ModelMessage[]) => boolean,
): ModelMessage[] {
    let current = messages;
    for (const stage of SHRINK_STAGES) {
        if (fits(current)) return current;
        current = stage(current);
    }
    return current;
}
