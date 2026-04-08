import type { ChatHistoryItem } from 'node-llama-cpp';
import { estimateTokenCount } from 'tokenx';
import lodash from 'lodash';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import * as aiRepo from '@main/database/repositories/ai.repository';
import log from '@main/lib/logger';
import { DEFAULT_REMOTE_TOKEN_BUDGET } from './token-budget';

const { omit, pick } = lodash;

export type PromptHistoryMessage = {
    role: 'user' | 'assistant';
    content: string;
};

// ── Local-only constants ──

const LOCAL_TOKEN_BUDGET = 3_000;
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
                const start = typeof output.startParagraph === 'number' ? output.startParagraph : 0;
                const range = loaded > 0 ? ` §${start}–${start + loaded - 1}` : '';
                return `${title}: ${loaded}/${total} paragraph(s)${range}`;
            }
            break;

        case 'searchContent': {
            const hits = output?.results ?? output;
            if (Array.isArray(hits)) {
                const summaries = hits.slice(0, TOOL_LIST_PREVIEW_LIMIT).map((hit: any) => {
                    const title = String(hit?.title ?? hit?.sermonId ?? '?');
                    const paragraphs = (hit?.matches ?? [])
                        .map((m: any) => m?.paragraphNumber)
                        .filter((n: any) => typeof n === 'number');
                    return paragraphs.length > 0 ? `${title} §${paragraphs.join(',')}` : title;
                });
                const extra =
                    hits.length > TOOL_LIST_PREVIEW_LIMIT
                        ? ` +${hits.length - TOOL_LIST_PREVIEW_LIMIT} more`
                        : '';
                return `${hits.length} content hit(s): ${summaries.join('; ')}${extra}`;
            }
            break;
        }

        case 'getCustomDocuments':
            if (Array.isArray(output))
                return summarizeList(
                    extractNames(output, 'title'),
                    `${output.length} custom document(s)`,
                );
            break;

        case 'searchCustomDocuments':
            if (output && typeof output === 'object' && Array.isArray(output.results))
                return summarizeList(
                    extractNames(output.results, 'title', 'documentId'),
                    `${output.results.length} custom document hit(s)`,
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
            if (
                output &&
                typeof output === 'object' &&
                Array.isArray(output.verses) &&
                output.verses.length > 0
            ) {
                const first = output.verses[0];
                const last = output.verses[output.verses.length - 1];
                const ref = `${first.bookName} ${first.chapter}:${first.verse}`;
                const end = output.verses.length > 1 ? `-${last.chapter}:${last.verse}` : '';
                return `${ref}${end} (${output.verses.length} verse(s))`;
            }
            break;

        case 'searchBible':
            if (output && typeof output === 'object' && 'total' in output) {
                const verses = Array.isArray(output.results) ? output.results : [];
                const refs = verses
                    .slice(0, 3)
                    .map((v: any) =>
                        v?.bookName && v?.chapter && v?.verse
                            ? `${v.bookName} ${v.chapter}:${v.verse}`
                            : '',
                    )
                    .filter(Boolean);
                const refsStr =
                    refs.length > 0 ? `: ${refs.join(', ')}${verses.length > 3 ? ' …' : ''}` : '';
                return `Bible search: ${output.total} verse(s) for "${output.query}"${refsStr}`;
            }
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
            if (output && typeof output === 'object') {
                const status = output.status === 'failed' ? 'failed' : 'completed';
                const label = status === 'failed' ? 'Research failed' : 'Research';
                return `${label}: ${truncate(normalizeWhitespace(String(output.summary ?? '')), charLimit)}`;
            }
            break;

        case 'readSermon':
            if (output && typeof output === 'object') {
                const status = output.status === 'failed' ? 'failed' : 'completed';
                const label = status === 'failed' ? 'Read sermon failed' : 'Read sermon';
                return `${label}: ${truncate(normalizeWhitespace(String(output.summary ?? '')), charLimit)}`;
            }
            break;
    }

    const raw = normalizeWhitespace(stringify(result.output));
    return raw ? `${result.name}: ${truncate(raw, charLimit)}` : result.name;
}

// ── Tool result formatting (recent / non-compact) ──

/**
 * Strip internal/noisy fields from tool output for recent (non-compact) history.
 * Keeps all reference data (IDs, paragraph numbers, titles, snippets)
 * but removes full text content, pagination cursors, and redundant metadata.
 */

const SHORT_PREVIEW = 120;
const LONG_PREVIEW = 300;

function previewText(value: unknown, maxChars: number): string {
    return truncate(normalizeWhitespace(String(value ?? '')), maxChars);
}

function cleanToolOutput(name: string, output: any): unknown {
    if (output == null || typeof output !== 'object') {
        return output;
    }

    switch (name) {
        case 'getSermonContent':
            if (!Array.isArray(output.paragraphs)) {
                return output;
            }
            return {
                ...output,
                paragraphs: output.paragraphs.map((p: any) => ({
                    paragraphNumber: p.paragraphNumber,
                    content: previewText(p.content, SHORT_PREVIEW),
                })),
            };

        case 'searchContent':
        case 'searchSermons':
            return omit(output, 'nextCursor');

        case 'getBiblePassage':
            if (!output || typeof output !== 'object' || !Array.isArray(output.verses)) {
                return output;
            }
            return {
                ...pick(output, [
                    'bookCode',
                    'bookName',
                    'chapter',
                    'fromVerse',
                    'toVerse',
                    'bibleVersionAbbreviation',
                    'verseCount',
                ]),
                verses: output.verses.map((v: any) => ({
                    ...pick(v, [
                        'bookCode',
                        'bookName',
                        'chapter',
                        'verse',
                        'testament',
                        'bibleVersionAbbreviation',
                    ]),
                    content: previewText(v.content, SHORT_PREVIEW),
                })),
            };

        case 'searchBible':
            if (!Array.isArray(output.results)) {
                return output;
            }
            return {
                query: output.query,
                bibleVersionAbbreviation: output.bibleVersionAbbreviation,
                total: output.total,
                returned: output.returned,
                hasMore: output.hasMore,
                results: output.results.map((verse: any) => ({
                    ...pick(verse, [
                        'bookCode',
                        'bookName',
                        'chapter',
                        'verse',
                        'testament',
                        'bibleVersionAbbreviation',
                    ]),
                    content: previewText(verse?.content, SHORT_PREVIEW),
                })),
            };

        case 'searchCustomDocuments':
            return omit(output, 'nextCursor');

        case 'getCustomDocumentContent':
            return { ...output, content: previewText(output.content, LONG_PREVIEW) };

        case 'getSubjectById':
            if (!Array.isArray(output.documents)) {
                return output;
            }
            return {
                ...output,
                documents: output.documents.map((doc: any) => ({
                    ...omit(doc, ['documentReference', 'textContent']),
                    textContent: previewText(doc.textContent, LONG_PREVIEW),
                })),
            };

        case 'addBibleReferenceToSubject':
        case 'addSermonReferenceToSubject':
            return omit(output, ['documentReference', 'textContent', 'bible']);

        case 'getNoteById':
        case 'createNote':
        case 'updateNoteContent':
            if (typeof output.content !== 'string') {
                return output;
            }
            return { ...output, content: previewText(output.content, LONG_PREVIEW) };

        default:
            return output;
    }
}

function formatToolResultRaw(result: AiToolResult): string {
    const cleaned = cleanToolOutput(result.name, result.output);
    const json = stringify(cleaned);
    return json ? `[Tool:${result.name}] ${json}` : `[Tool:${result.name}]`;
}

function formatToolResultCompact(result: AiToolResult, charLimit: number): string {
    return `[Tool] ${summarizeToolResult(result, charLimit)}`;
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

    let toolLines: string[];
    if (compact) {
        toolLines = message.toolResults
            .slice(0, limits.toolResultCountLimit)
            .map((r) => formatToolResultCompact(r, limits.toolResultCharLimit))
            .filter(Boolean);
    } else {
        toolLines = message.toolResults.map((r) => formatToolResultRaw(r)).filter(Boolean);
    }

    const combined = [mainText, ...toolLines].filter(Boolean).join('\n');
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
    remoteTokenBudget?: number,
): { summary: string | null; recentMessages: PromptHistoryMessage[] } {
    const limits = isLocal ? LOCAL_LIMITS : REMOTE_LIMITS;
    const tokenBudget = isLocal
        ? LOCAL_TOKEN_BUDGET
        : (remoteTokenBudget ?? DEFAULT_REMOTE_TOKEN_BUDGET);
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
