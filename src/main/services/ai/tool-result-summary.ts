import type { AiToolResult } from '@shared/ai.types';

const TOOL_LIST_PREVIEW_LIMIT = 3;

export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, maxChars: number): string {
    return value.length <= maxChars
        ? value
        : `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function stringifyToolOutput(output: unknown): string {
    if (output == null) return '';
    if (typeof output === 'string') return output;
    try {
        return JSON.stringify(output);
    } catch {
        return String(output);
    }
}

export function getAgentOutputText(output: any): string {
    return output && typeof output.response === 'string' ? output.response : '';
}

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

export function summarizeToolResult(result: AiToolResult, charLimit: number): string {
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
                const more = output.hasMore
                    ? `, more from verse ${output.nextFromVerse} to ${output.nextToVerse}`
                    : '';
                return `${ref}${end} (${output.verses.length} verse(s)${more})`;
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

    const raw = normalizeWhitespace(stringifyToolOutput(result.output));
    return raw ? `${result.name}: ${truncate(raw, charLimit)}` : result.name;
}
