import type { ChatHistoryItem } from 'node-llama-cpp';
import { estimateTokenCount } from 'tokenx';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import * as aiRepo from '@main/database/repositories/ai.repository';
import log from '@main/lib/logger';

export type PromptHistoryMessage = {
    role: 'user' | 'assistant';
    content: string;
};

const LOCAL_MAX_TOKENS = 768;
const LOCAL_CONTEXT_BUFFER = 128;

const SUMMARY_CHAR_BUDGET = 6000;
const USER_MESSAGE_CHAR_LIMIT = 320;
const ASSISTANT_MESSAGE_CHAR_LIMIT = 460;
const COMPACTED_USER_MESSAGE_CHAR_LIMIT = 180;
const COMPACTED_ASSISTANT_MESSAGE_CHAR_LIMIT = 220;
const TOOL_RESULT_CHAR_LIMIT = 220;
const TOOL_RESULT_COUNT_LIMIT = 3;
const TOOL_LIST_PREVIEW_LIMIT = 3;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
        return value;
    }

    return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function stringifyToolOutput(output: unknown): string {
    if (output == null) {
        return '';
    }

    if (typeof output === 'string') {
        return output;
    }

    try {
        return JSON.stringify(output);
    } catch {
        return String(output);
    }
}

function summarizeNamedList(values: string[], label: string): string {
    if (values.length === 0) {
        return `${label}: none`;
    }

    const preview = values.slice(0, TOOL_LIST_PREVIEW_LIMIT).join(', ');
    if (values.length <= TOOL_LIST_PREVIEW_LIMIT) {
        return `${label}: ${preview}`;
    }

    return `${label}: ${preview} +${values.length - TOOL_LIST_PREVIEW_LIMIT} more`;
}

function summarizeToolResult(result: AiToolResult): string {
    const output = result.output as any;

    switch (result.name) {
        case 'getLanguages':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((language) => {
                            return String(language?.code ?? '');
                        })
                        .filter(Boolean),
                    'Languages',
                );
            }
            break;

        case 'searchSermons':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((sermon) => {
                            return String(sermon?.title ?? sermon?.sermonId ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} sermon result(s)`,
                );
            }
            break;

        case 'getSermonContent':
            if (output && typeof output === 'object') {
                const title = String(output.meta?.title ?? output.meta?.sermonId ?? 'sermon');
                const returnedParagraphs = Array.isArray(output.paragraphs)
                    ? output.paragraphs.length
                    : 0;
                const totalParagraphs =
                    typeof output.totalParagraphs === 'number'
                        ? output.totalParagraphs
                        : returnedParagraphs;
                return `${title}: ${returnedParagraphs}/${totalParagraphs} paragraph(s) loaded`;
            }
            break;

        case 'searchContent':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((item) => {
                            return String(item?.meta?.title ?? item?.sermonId ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} content hit(s)`,
                );
            }
            break;

        case 'getCustomDocuments':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((document) => {
                            return String(document?.title ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} custom document(s)`,
                );
            }
            break;

        case 'getCustomDocumentContent':
            if (output && typeof output === 'object') {
                const title = String(output.title ?? output.documentId ?? 'document');
                const content = normalizeWhitespace(String(output.content ?? ''));
                return `${title}: ${truncateText(content, TOOL_RESULT_CHAR_LIMIT)}`;
            }
            break;

        case 'getBibleVersions':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((version) => {
                            return String(version?.abbreviation ?? version?.title ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} Bible version(s)`,
                );
            }
            break;

        case 'getBiblePassage':
            if (Array.isArray(output) && output.length > 0) {
                const firstVerse = output[0];
                const lastVerse = output[output.length - 1];
                const startRef = `${firstVerse.bookName} ${firstVerse.chapter}:${firstVerse.verse}`;
                const endRef = `${lastVerse.chapter}:${lastVerse.verse}`;
                return `${startRef}${output.length > 1 ? `-${endRef}` : ''} (${output.length} verse(s))`;
            }
            break;

        case 'getSubjects':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((subject) => {
                            return String(subject?.name ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} subject(s)`,
                );
            }
            break;

        case 'createSubject':
            if (output && typeof output === 'object') {
                return `Created subject: ${String(output.name ?? output.id ?? 'subject')}`;
            }
            break;

        case 'getNotes':
            if (Array.isArray(output)) {
                return summarizeNamedList(
                    output
                        .map((note) => {
                            return String(note?.name ?? '');
                        })
                        .filter(Boolean),
                    `${output.length} note(s)`,
                );
            }
            break;

        case 'getNoteById':
        case 'createNote':
        case 'updateNoteContent':
            if (output && typeof output === 'object') {
                const title = String(output.name ?? output.id ?? 'note');
                const content = normalizeWhitespace(String(output.content ?? ''));
                return `${title}: ${truncateText(content, TOOL_RESULT_CHAR_LIMIT)}`;
            }
            break;

        case 'addSermonReferenceToSubject':
        case 'addBibleReferenceToSubject':
            if (output && typeof output === 'object') {
                return `Subject updated: ${String(output.subjectName ?? output.documentTitle ?? 'reference added')}`;
            }
            break;

        case 'addSermonReferenceToNote':
        case 'addBibleReferenceToNote':
            if (output && typeof output === 'object') {
                return `Note updated: ${String(output.label ?? output.noteId ?? 'reference added')}`;
            }
            break;

        default:
            break;
    }

    const rawOutput = normalizeWhitespace(stringifyToolOutput(result.output));
    if (!rawOutput) {
        return result.name;
    }

    return `${result.name}: ${truncateText(rawOutput, TOOL_RESULT_CHAR_LIMIT)}`;
}

function formatMessageForPrompt(
    message: AiMessage,
    contentLimit: number,
    includeToolSummaries: boolean,
): PromptHistoryMessage | null {
    if (message.role !== 'user' && message.role !== 'assistant') {
        return null;
    }

    const mainText = normalizeWhitespace(message.content);
    const toolSummary = includeToolSummaries
        ? message.toolResults
              .slice(0, TOOL_RESULT_COUNT_LIMIT)
              .map((result) => {
                  return summarizeToolResult(result);
              })
              .filter(Boolean)
        : [];

    const combined = [
        mainText,
        ...toolSummary.map((item) => {
            return `[Tool] ${item}`;
        }),
    ]
        .filter(Boolean)
        .join('\n');

    if (!combined) {
        return null;
    }

    return {
        role: message.role,
        content: truncateText(combined, contentLimit),
    };
}

function buildSummary(messages: PromptHistoryMessage[]): string | null {
    if (messages.length === 0) {
        return null;
    }

    const lines = messages.map((message) => {
        const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
        return `${roleLabel}: ${message.content}`;
    });

    const summary = lines.join('\n');
    if (summary.length <= SUMMARY_CHAR_BUDGET) {
        return summary;
    }

    const trimmedLines: string[] = [];
    let usedChars = 0;
    let droppedCount = 0;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        const nextSize = usedChars + line.length + (trimmedLines.length > 0 ? 1 : 0);
        if (nextSize > SUMMARY_CHAR_BUDGET) {
            droppedCount = index + 1;
            break;
        }

        trimmedLines.unshift(line);
        usedChars = nextSize;
    }

    if (droppedCount > 0) {
        trimmedLines.unshift(`[Earlier conversation compacted: ${droppedCount} message(s)]`);
    }

    return trimmedLines.join('\n');
}

function estimateTokens(text: string): number {
    try {
        return estimateTokenCount(text);
    } catch {
        return Math.ceil(text.length / 3.5);
    }
}

function historyItemTokens(item: ChatHistoryItem): number {
    if (item.type === 'user') {
        return estimateTokens(item.text);
    }
    if (item.type === 'model') {
        let tokens = 0;
        for (const part of item.response) {
            if (typeof part === 'string') {
                tokens += estimateTokens(part);
            } else {
                tokens += estimateTokens(JSON.stringify(part));
            }
        }
        return tokens;
    }
    return 0;
}

export function compactLocalHistory(
    systemPrompt: string,
    history: ChatHistoryItem[],
    prompt: string,
    contextSize: number,
): ChatHistoryItem[] {
    const available = contextSize - LOCAL_MAX_TOKENS - LOCAL_CONTEXT_BUFFER;
    const fixedTokens = estimateTokens(systemPrompt) + estimateTokens(prompt);

    if (fixedTokens >= available) {
        log.warn('System prompt + user prompt alone exceed context budget, sending empty history');
        return [];
    }

    let budget = available - fixedTokens;
    const result: ChatHistoryItem[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
        const cost = historyItemTokens(history[i]);
        if (cost > budget) break;
        budget -= cost;
        result.unshift(history[i]);
    }

    if (result.length < history.length) {
        log.info('Local history compacted', {
            original: history.length,
            kept: result.length,
            contextSize,
        });
    }

    return result;
}

export function buildConversationContext(
    conversationId: string,
    maxContextMessages: number,
): {
    summary: string | null;
    recentMessages: PromptHistoryMessage[];
} {
    const sourceMessages = aiRepo.getMessages(conversationId);
    const recentBoundary = Math.max(0, sourceMessages.length - maxContextMessages);

    const olderMessages = sourceMessages
        .slice(0, recentBoundary)
        .map((message) => {
            const contentLimit =
                message.role === 'user'
                    ? COMPACTED_USER_MESSAGE_CHAR_LIMIT
                    : COMPACTED_ASSISTANT_MESSAGE_CHAR_LIMIT;
            return formatMessageForPrompt(message, contentLimit, true);
        })
        .filter((message): message is PromptHistoryMessage => {
            return message != null;
        });

    const recentMessages = sourceMessages
        .slice(recentBoundary)
        .map((message) => {
            const contentLimit =
                message.role === 'user' ? USER_MESSAGE_CHAR_LIMIT : ASSISTANT_MESSAGE_CHAR_LIMIT;
            return formatMessageForPrompt(message, contentLimit, true);
        })
        .filter((message): message is PromptHistoryMessage => {
            return message != null;
        });

    return {
        summary: buildSummary(olderMessages),
        recentMessages,
    };
}
