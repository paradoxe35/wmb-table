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

const MAX_LOADED_MESSAGES = 40;
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

const TOOL_LIST_PREVIEW_LIMIT = 3;

/** `buildSummary` prefixes each compacted line with its role, which the raw content misses. */
const SUMMARY_LINE_OVERHEAD_TOKENS = 4;

// ── Text utilities ──

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/** Keeps line structure: history is the model's formatting example, and flattening it made
 * replies drift toward run-together text. */
function normalizeStructuredText(value: string): string {
    return value
        .replace(/\r\n?/g, '\n')
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ +$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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

function getAgentOutputText(output: any): string {
    if (!output || typeof output !== 'object') {
        return '';
    }

    if (typeof output.response === 'string') {
        return output.response;
    }

    if (typeof output.summary === 'string') {
        return output.summary;
    }

    return '';
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
                    extractNames(output, 'bibleVersionAbbreviation', 'name'),
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
                return `Created subject: ${String(output.name ?? output.subjectId ?? 'subject')}`;
            break;

        case 'getNotes':
            if (Array.isArray(output))
                return summarizeList(extractNames(output, 'name'), `${output.length} note(s)`);
            break;

        case 'getNoteById':
            if (output && typeof output === 'object') {
                const title = String(output.name ?? output.noteId ?? 'note');
                return `${title}: ${truncate(normalizeWhitespace(String(output.content ?? '')), charLimit)}`;
            }
            break;

        case 'createNote':
            if (output && typeof output === 'object')
                return `Created note: ${String(output.name ?? output.noteId ?? 'note')}`;
            break;

        case 'updateNoteContent':
        case 'appendToNote':
            if (output && typeof output === 'object')
                return `Note updated: ${String(output.name ?? output.noteId ?? 'note')}`;
            break;

        case 'editNote':
            if (output && typeof output === 'object')
                return `Note edited: ${String(output.name ?? output.noteId ?? 'note')} (${String(output.replacements ?? 0)} replacement(s))`;
            break;

        case 'getSubjectById':
            if (output && typeof output === 'object') {
                const docs = Array.isArray(output.documents) ? output.documents.length : 0;
                return `Subject "${String(output.name ?? output.subjectId ?? 'subject')}": ${docs} reference(s)`;
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

        case 'researchTopic':
            if (output && typeof output === 'object') {
                const status = output.status === 'failed' ? 'failed' : 'completed';
                const label = status === 'failed' ? 'Research failed' : 'Research';
                return `${label}: ${truncate(normalizeWhitespace(getAgentOutputText(output)), charLimit)}`;
            }
            break;

        case 'readSermon':
            if (output && typeof output === 'object') {
                const status = output.status === 'failed' ? 'failed' : 'completed';
                const label = status === 'failed' ? 'Read sermon failed' : 'Read sermon';
                return `${label}: ${truncate(normalizeWhitespace(getAgentOutputText(output)), charLimit)}`;
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
                return omit(output, 'nextCursor');
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

        case 'researchTopic':
        case 'readSermon': {
            const text = getAgentOutputText(output);
            if (!text) {
                return output;
            }

            return {
                ...output,
                response: previewText(text, LONG_PREVIEW),
            };
        }

        case 'getNoteById':
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

    const mainText = compact
        ? normalizeWhitespace(message.content)
        : normalizeStructuredText(message.content);

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

export interface ConversationContext {
    recentMessages: PromptHistoryMessage[];
    summary: string | null;
    /** Whole history before compaction; reporting only. */
    historyTokenCount: number;
    /** What the recent messages actually cost after compaction and trimming. */
    recentTokenCount: number;
}

/**
 * `tokenBudget` covers the recent messages and the summary together, since the summary ships in
 * the system prompt of the same request. Recent turns that still overflow are shrunk in place.
 */
function splitByTokenBudget(
    messages: AiMessage[],
    tokenBudget: number,
    limits: ContextLimits,
): ConversationContext {
    const formatted = messages.map((msg) => formatMessage(msg, Infinity, limits, false));

    const compactedCache = new Map<number, PromptHistoryMessage | null>();
    const compactAt = (index: number): PromptHistoryMessage | null => {
        if (!compactedCache.has(index)) {
            const msg = messages[index];
            const charLimit =
                msg.role === 'user'
                    ? limits.compactedUserCharLimit
                    : limits.compactedAssistantCharLimit;
            compactedCache.set(index, formatMessage(msg, charLimit, limits, true));
        }
        return compactedCache.get(index) ?? null;
    };

    let splitIndex = 0;
    const minRecentIndex = Math.max(0, messages.length - MIN_KEPT_TURNS * 2);
    let recentTokens = formatted.reduce((sum, m) => sum + (m ? estimateTokens(m.content) : 0), 0);
    const historyTokenCount = recentTokens;
    let summaryTokens = 0;

    while (recentTokens + summaryTokens > tokenBudget && splitIndex < minRecentIndex) {
        const full = formatted[splitIndex];
        if (full) recentTokens -= estimateTokens(full.content);
        const compacted = compactAt(splitIndex);
        if (compacted) {
            summaryTokens += estimateTokens(compacted.content) + SUMMARY_LINE_OVERHEAD_TOKENS;
        }
        splitIndex++;
    }

    // A pending generation persists an empty assistant message, which formats to null, so the
    // latest turn is the last non-empty entry rather than the last index.
    let latestIndex = formatted.length - 1;
    while (latestIndex >= 0 && formatted[latestIndex] == null) {
        latestIndex--;
    }

    let trimmedCount = 0;
    for (
        let index = splitIndex;
        recentTokens + summaryTokens > tokenBudget && index < latestIndex;
        index++
    ) {
        const full = formatted[index];
        const compacted = compactAt(index);
        if (!full || !compacted) {
            continue;
        }

        const fullTokens = estimateTokens(full.content);
        const compactedTokens = estimateTokens(compacted.content);
        if (compactedTokens >= fullTokens) {
            continue;
        }

        recentTokens += compactedTokens - fullTokens;
        formatted[index] = compacted;
        trimmedCount++;
    }

    if (splitIndex > 0 || trimmedCount > 0) {
        log.info('Context compacted by token budget', {
            totalMessages: messages.length,
            compactedMessages: splitIndex,
            trimmedRecentMessages: trimmedCount,
            recentMessages: messages.length - splitIndex,
            estimatedTokens: recentTokens + summaryTokens,
            tokenBudget,
        });
    }

    const olderFormatted = messages
        .slice(0, splitIndex)
        .map((_msg, index) => compactAt(index))
        .filter((m): m is PromptHistoryMessage => m != null);

    const recentMessages = formatted
        .slice(splitIndex)
        .filter((m): m is PromptHistoryMessage => m != null);

    return {
        recentMessages,
        historyTokenCount,
        recentTokenCount: recentTokens,
        summary: buildSummary(olderFormatted, limits.summaryCharBudget),
    };
}

// ── Public API ──

export function buildConversationContext(
    conversationId: string,
    remoteTokenBudget?: number,
): ConversationContext {
    const limits = REMOTE_LIMITS;
    const tokenBudget = remoteTokenBudget ?? DEFAULT_REMOTE_TOKEN_BUDGET;
    const messages = aiRepo.getRecentMessages(conversationId, MAX_LOADED_MESSAGES);
    return splitByTokenBudget(messages, tokenBudget, limits);
}
