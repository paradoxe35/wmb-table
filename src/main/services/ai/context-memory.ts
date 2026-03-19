import type { ChatHistoryItem } from 'node-llama-cpp';
import { estimateTokenCount } from 'tokenx';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import * as aiRepo from '@main/database/repositories/ai.repository';
import log from '@main/lib/logger';

export type PromptHistoryMessage = {
    role: 'user' | 'assistant';
    content: string;
};

// ── Token budgets ──

const REMOTE_TOKEN_BUDGET = 32_000;
const LOCAL_TOKEN_BUDGET = 3000;
const MAX_LOADED_MESSAGES = 40;
const LOCAL_GENERATION_RESERVE = 1024;
const LOCAL_CONTEXT_OVERHEAD = 128;
const MIN_KEPT_TURNS = 4;

// ── Per-message formatting limits ──

export interface ContextLimits {
    summaryCharBudget: number;
    userCharLimit: number;
    assistantCharLimit: number;
    compactedUserCharLimit: number;
    compactedAssistantCharLimit: number;
    toolResultCharLimit: number;
    toolResultCountLimit: number;
}

export const REMOTE_LIMITS: ContextLimits = {
    summaryCharBudget: 12_000,
    userCharLimit: 1200,
    assistantCharLimit: 1600,
    compactedUserCharLimit: 400,
    compactedAssistantCharLimit: 500,
    toolResultCharLimit: 600,
    toolResultCountLimit: 6,
};

export const LOCAL_LIMITS: ContextLimits = {
    summaryCharBudget: 4000,
    userCharLimit: 280,
    assistantCharLimit: 400,
    compactedUserCharLimit: 150,
    compactedAssistantCharLimit: 200,
    toolResultCharLimit: 180,
    toolResultCountLimit: 3,
};

const TOOL_LIST_PREVIEW_LIMIT = 3;

// ── Text utilities ──

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxChars: number): string {
    return value.length <= maxChars
        ? value
        : `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function stringify(output: unknown): string {
    if (output == null) return '';
    if (typeof output === 'string') return output;
    try {
        return JSON.stringify(output);
    } catch {
        return String(output);
    }
}

function estimateTokens(text: string): number {
    try {
        return estimateTokenCount(text);
    } catch {
        return Math.ceil(text.length / 3.5);
    }
}

// ── Tool result summarization ──

function summarizeList(values: string[], label: string): string {
    if (values.length === 0) return `${label}: none`;
    const preview = values.slice(0, TOOL_LIST_PREVIEW_LIMIT).join(', ');
    const extra =
        values.length > TOOL_LIST_PREVIEW_LIMIT
            ? ` +${values.length - TOOL_LIST_PREVIEW_LIMIT} more`
            : '';
    return `${label}: ${preview}${extra}`;
}

function extractNames(items: unknown[], key: string, fallback?: string): string[] {
    return items
        .map((item: any) => String(item?.[key] ?? (fallback ? item?.[fallback] : '') ?? ''))
        .filter(Boolean);
}

function summarizeToolResult(result: AiToolResult, charLimit: number): string {
    const output = result.output as any;

    switch (result.name) {
        case 'getLanguages':
            if (Array.isArray(output))
                return summarizeList(extractNames(output, 'code'), 'Languages');
            break;

        case 'searchSermons': {
            const results = output?.results ?? output;
            if (Array.isArray(results))
                return summarizeList(
                    extractNames(results, 'title', 'sermonId'),
                    `${results.length} sermon result(s)`,
                );
            break;
        }

        case 'getSermonContent':
            if (output && typeof output === 'object') {
                const title = String(output.meta?.title ?? output.meta?.sermonId ?? 'sermon');
                const loaded = Array.isArray(output.paragraphs) ? output.paragraphs.length : 0;
                const total =
                    typeof output.totalParagraphs === 'number' ? output.totalParagraphs : loaded;
                return `${title}: ${loaded}/${total} paragraph(s) loaded`;
            }
            break;

        case 'searchContent': {
            const hits = output?.results ?? output;
            if (Array.isArray(hits))
                return summarizeList(
                    extractNames(hits, 'title', 'sermonId'),
                    `${hits.length} content hit(s)`,
                );
            break;
        }

        case 'getCustomDocuments':
            if (Array.isArray(output))
                return summarizeList(
                    extractNames(output, 'title'),
                    `${output.length} custom document(s)`,
                );
            break;

        case 'getCustomDocumentContent':
            if (output && typeof output === 'object') {
                const title = String(output.title ?? output.documentId ?? 'document');
                return `${title}: ${truncate(normalizeWhitespace(String(output.content ?? '')), charLimit)}`;
            }
            break;

        case 'getBibleVersions':
            if (Array.isArray(output))
                return summarizeList(
                    extractNames(output, 'abbreviation', 'title'),
                    `${output.length} Bible version(s)`,
                );
            break;

        case 'getBiblePassage':
            if (Array.isArray(output) && output.length > 0) {
                const first = output[0];
                const last = output[output.length - 1];
                const ref = `${first.bookName} ${first.chapter}:${first.verse}`;
                const end = output.length > 1 ? `-${last.chapter}:${last.verse}` : '';
                return `${ref}${end} (${output.length} verse(s))`;
            }
            break;

        case 'searchBible':
            if (output && typeof output === 'object' && 'total' in output)
                return `Bible search: ${output.total} verse(s) found for "${output.query}"`;
            break;

        case 'getSubjects':
            if (Array.isArray(output))
                return summarizeList(extractNames(output, 'name'), `${output.length} subject(s)`);
            break;

        case 'createSubject':
            if (output && typeof output === 'object')
                return `Created subject: ${String(output.name ?? output.id ?? 'subject')}`;
            break;

        case 'getNotes':
            if (Array.isArray(output))
                return summarizeList(extractNames(output, 'name'), `${output.length} note(s)`);
            break;

        case 'getNoteById':
        case 'createNote':
        case 'updateNoteContent':
            if (output && typeof output === 'object') {
                const title = String(output.name ?? output.id ?? 'note');
                return `${title}: ${truncate(normalizeWhitespace(String(output.content ?? '')), charLimit)}`;
            }
            break;

        case 'getSubjectById':
            if (output && typeof output === 'object') {
                const docs = Array.isArray(output.documents) ? output.documents.length : 0;
                return `Subject "${String(output.name ?? output.id ?? 'subject')}": ${docs} reference(s)`;
            }
            break;

        case 'addSermonReferenceToSubject':
        case 'addBibleReferenceToSubject':
            if (output && typeof output === 'object')
                return `Subject updated: ${String(output.documentTitle ?? output.subjectId ?? 'reference added')}`;
            break;

        case 'removeSubjectReference':
            if (output && typeof output === 'object' && output.success)
                return `Reference removed: ${String(output.deletedId ?? 'done')}`;
            break;

        case 'addSermonReferenceToNote':
            if (output && typeof output === 'object')
                return `Note updated: ${String(output.label ?? output.noteId ?? 'reference added')}`;
            break;

        case 'researchTopic':
            if (output && typeof output === 'object')
                return `Research: ${truncate(normalizeWhitespace(String(output.summary ?? '')), charLimit)}`;
            break;

        case 'readSermon':
            if (output && typeof output === 'object') {
                const id = String(output.sermonId ?? 'sermon');
                return `Read ${id}: ${truncate(normalizeWhitespace(String(output.summary ?? '')), charLimit)}`;
            }
            break;
    }

    const raw = normalizeWhitespace(stringify(result.output));
    return raw ? `${result.name}: ${truncate(raw, charLimit)}` : result.name;
}

// ── Message formatting ──

function formatMessage(
    message: AiMessage,
    contentLimit: number,
    limits: ContextLimits,
    compact: boolean,
): PromptHistoryMessage | null {
    if (message.role !== 'user' && message.role !== 'assistant') return null;

    const mainText = normalizeWhitespace(message.content);
    const maxTools = compact ? limits.toolResultCountLimit : message.toolResults.length;
    const toolCharLimit = compact ? limits.toolResultCharLimit : Infinity;
    const toolSummary = message.toolResults
        .slice(0, maxTools)
        .map((r) => summarizeToolResult(r, toolCharLimit))
        .filter(Boolean)
        .map((s) => `[Tool] ${s}`);

    const combined = [mainText, ...toolSummary].filter(Boolean).join('\n');
    if (!combined) return null;

    return { role: message.role, content: compact ? truncate(combined, contentLimit) : combined };
}

// ── Summary builder ──

function buildSummary(messages: PromptHistoryMessage[], charBudget: number): string | null {
    if (messages.length === 0) return null;

    const lines = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`);
    const full = lines.join('\n');
    if (full.length <= charBudget) return full;

    // Keep newest lines that fit within budget
    const kept: string[] = [];
    let usedChars = 0;
    let droppedCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
        const nextSize = usedChars + lines[i].length + (kept.length > 0 ? 1 : 0);
        if (nextSize > charBudget) {
            droppedCount = i + 1;
            break;
        }
        kept.unshift(lines[i]);
        usedChars = nextSize;
    }

    if (droppedCount > 0) {
        kept.unshift(`[Earlier conversation compacted: ${droppedCount} message(s)]`);
    }

    return kept.join('\n');
}

// ── Token-based compaction ──

/**
 * Split messages into recent (full detail) and older (compacted into summary).
 * Compaction triggers when total tokens exceed the budget, keeping at least
 * MIN_KEPT_TURNS recent turns intact.
 */
function splitByTokenBudget(
    messages: AiMessage[],
    tokenBudget: number,
    limits: ContextLimits,
): { recentMessages: PromptHistoryMessage[]; summary: string | null } {
    // Format all messages at full detail (no truncation)
    const formatted = messages.map((msg) => formatMessage(msg, Infinity, limits, false));

    // Find the split point: move oldest to compacted until under budget
    let splitIndex = 0;
    const minRecentIndex = Math.max(0, messages.length - MIN_KEPT_TURNS * 2);
    let totalTokens = formatted.reduce((sum, m) => sum + (m ? estimateTokens(m.content) : 0), 0);

    while (totalTokens > tokenBudget && splitIndex < minRecentIndex) {
        const msg = formatted[splitIndex];
        if (msg) totalTokens -= estimateTokens(msg.content);
        splitIndex++;
    }

    if (splitIndex > 0) {
        log.info('Context compacted by token budget', {
            totalMessages: messages.length,
            compactedMessages: splitIndex,
            recentMessages: messages.length - splitIndex,
            estimatedTokens: totalTokens,
            tokenBudget,
        });
    }

    // Compact older messages with tight limits
    const olderFormatted = messages
        .slice(0, splitIndex)
        .map((msg) => {
            const charLimit =
                msg.role === 'user'
                    ? limits.compactedUserCharLimit
                    : limits.compactedAssistantCharLimit;
            return formatMessage(msg, charLimit, limits, true);
        })
        .filter((m): m is PromptHistoryMessage => m != null);

    // Recent messages keep full detail
    const recentMessages = formatted
        .slice(splitIndex)
        .filter((m): m is PromptHistoryMessage => m != null);

    return {
        recentMessages,
        summary: buildSummary(olderFormatted, limits.summaryCharBudget),
    };
}

// ── Public API ──

export function buildConversationContext(
    conversationId: string,
    isLocal: boolean,
): { summary: string | null; recentMessages: PromptHistoryMessage[] } {
    const limits = isLocal ? LOCAL_LIMITS : REMOTE_LIMITS;
    const tokenBudget = isLocal ? LOCAL_TOKEN_BUDGET : REMOTE_TOKEN_BUDGET;
    const messages = aiRepo.getRecentMessages(conversationId, MAX_LOADED_MESSAGES);
    return splitByTokenBudget(messages, tokenBudget, limits);
}

/**
 * Compact local model chat history to fit within the model's context window.
 * Used by the local llama.cpp provider after the AI SDK history is built.
 */
export function compactLocalHistory(
    systemPrompt: string,
    history: ChatHistoryItem[],
    prompt: string,
    contextSize: number,
): ChatHistoryItem[] {
    const available = contextSize - LOCAL_GENERATION_RESERVE - LOCAL_CONTEXT_OVERHEAD;
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

function historyItemTokens(item: ChatHistoryItem): number {
    if (item.type === 'user') return estimateTokens(item.text);
    if (item.type === 'model') {
        return item.response.reduce((tokens, part) => {
            return tokens + estimateTokens(typeof part === 'string' ? part : JSON.stringify(part));
        }, 0);
    }
    return 0;
}
