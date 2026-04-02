import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import * as bibleRepo from '@main/database/repositories/bible.repository';
import * as customDocRepo from '@main/database/repositories/custom-documents.repository';
import i18n from '@main/lib/i18n';
import { escapeHtml } from '@shared/searchable';
import { getDocumentIdentityKey, type HighlightItem } from '@shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentContext {
    title: string;
    meta?: string;
    paragraphContents: Map<number, string>;
}

interface HighlightSection {
    context: DocumentContext;
    highlights: DeduplicatedHighlight[];
}

interface DeduplicatedHighlight {
    paragraphIndex: number;
    textSnippet: string;
    color: string;
    comment?: string;
}

// ---------------------------------------------------------------------------
// Data grouping
// ---------------------------------------------------------------------------

function groupByDocument(items: HighlightItem[]): Map<string, HighlightItem[]> {
    const grouped = new Map<string, HighlightItem[]>();
    for (const item of items) {
        const key = `${item.documentTitle}::${getDocumentIdentityKey(item.documentIdentity)}`;
        const list = grouped.get(key) ?? [];
        list.push(item);
        grouped.set(key, list);
    }
    return grouped;
}

function deduplicateByGroup(items: HighlightItem[]): DeduplicatedHighlight[] {
    const seen = new Set<string>();
    const result: DeduplicatedHighlight[] = [];
    for (const item of items) {
        if (seen.has(item.groupId)) continue;
        seen.add(item.groupId);
        result.push({
            paragraphIndex: item.paragraphIndex,
            textSnippet: item.textSnippet,
            color: item.color,
            comment: item.comment,
        });
    }
    return result;
}

// ---------------------------------------------------------------------------
// Context fetching (per document type)
// ---------------------------------------------------------------------------

function formatDate(dateMs: number): string {
    return new Date(dateMs).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

async function fetchSermonContext(first: HighlightItem): Promise<Partial<DocumentContext>> {
    const paragraphContents = new Map<number, string>();
    let meta: string | undefined;
    if (first.documentIdentity.documentType !== 'sermon') {
        return { paragraphContents };
    }
    if (first.documentIdentity.translationId == null) {
        return { paragraphContents };
    }

    const sermon = referenceDataService.getSermonMeta(
        first.documentIdentity.translationId,
        first.languageCode,
        first.documentIdentity.sermonId,
    );
    if (!sermon) {
        return { paragraphContents };
    }

    const parts: string[] = [];
    if (sermon.dateMs) parts.push(formatDate(sermon.dateMs));
    if (sermon.location) parts.push(escapeHtml(sermon.location));
    if (sermon.traductionName)
        parts.push(`${i18n.t('Traduction:')} ${escapeHtml(sermon.traductionName)}`);
    if (parts.length > 0) meta = parts.join(' — ');

    try {
        const paragraphs = await tantivyService.getSermonParagraphs(
            first.languageCode,
            first.documentIdentity.translationId,
            sermon.dateMs,
        );
        for (const p of paragraphs) paragraphContents.set(p.paragraphIndex, p.content);
    } catch {
        /* unavailable */
    }

    return { meta, paragraphContents };
}

function fetchBibleContext(first: HighlightItem): Partial<DocumentContext> {
    const paragraphContents = new Map<number, string>();
    if (first.documentIdentity.documentType !== 'bible') return { paragraphContents };
    const verses = bibleRepo.getBooks({
        book: first.documentIdentity.bibleBook,
        chapter: first.documentIdentity.bibleChapter,
    });

    for (const v of verses) {
        paragraphContents.set(+v.verse, v.content);
    }

    return { paragraphContents };
}

function fetchCustomDocContext(first: HighlightItem): Partial<DocumentContext> {
    const paragraphContents = new Map<number, string>();
    if (first.documentIdentity.documentType !== 'custom') return { paragraphContents };
    const doc = customDocRepo.getCustomDocumentContent(first.documentIdentity.customDocumentId);
    if (doc?.content) {
        try {
            const lines: string[] = JSON.parse(doc.content);
            lines.forEach((text, i) => paragraphContents.set(i + 1, text));
        } catch {
            doc.content
                .split('\n')
                .filter((l) => l.trim())
                .forEach((text, i) => paragraphContents.set(i + 1, text));
        }
    }
    return { paragraphContents };
}

async function fetchDocumentContext(items: HighlightItem[]): Promise<DocumentContext> {
    const first = items[0];
    let partial: Partial<DocumentContext> = {};

    if (first.documentIdentity.documentType === 'sermon') {
        partial = await fetchSermonContext(first);
    } else if (first.documentIdentity.documentType === 'bible') {
        partial = fetchBibleContext(first);
    } else if (first.documentIdentity.documentType === 'custom') {
        partial = fetchCustomDocContext(first);
    }

    return {
        title: first.documentTitle,
        meta: partial.meta,
        paragraphContents: partial.paragraphContents ?? new Map(),
    };
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function renderParagraphWithMark(fullContent: string, snippet: string, color: string): string {
    const idx = fullContent.indexOf(snippet);
    if (idx < 0) {
        return escapeHtml(fullContent);
    }

    const before = escapeHtml(fullContent.slice(0, idx));
    const marked = escapeHtml(fullContent.slice(idx, idx + snippet.length));
    const after = escapeHtml(fullContent.slice(idx + snippet.length));
    return `${before}<mark style="background:${escapeHtml(color)}30;">${marked}</mark>${after}`;
}

function renderHighlightCard(
    h: DeduplicatedHighlight,
    paragraphContents: Map<number, string>,
): string {
    const fullContent = paragraphContents.get(h.paragraphIndex);
    const lines: string[] = [`<div class="highlight-card">`];

    // Left color accent is handled by border-left in CSS via inline style
    lines[0] = `<div class="highlight-card" style="border-left: 3px solid ${escapeHtml(h.color)};">`;

    // Header: paragraph number
    if (h.paragraphIndex > 0) {
        lines.push(
            `<div class="highlight-header"><span class="paragraph-num">&sect;${h.paragraphIndex}</span></div>`,
        );
    }

    // Content: full paragraph with mark, or just the snippet
    if (fullContent) {
        lines.push(
            `<p class="paragraph-content">${renderParagraphWithMark(fullContent, h.textSnippet, h.color)}</p>`,
        );
    } else {
        lines.push(
            `<p class="highlight-snippet"><mark style="background:${escapeHtml(h.color)}30;">${escapeHtml(h.textSnippet)}</mark></p>`,
        );
    }

    if (h.comment) {
        lines.push(`<div class="highlight-comment">${escapeHtml(h.comment)}</div>`);
    }

    lines.push(`</div>`);
    return lines.join('\n');
}

function renderSection(section: HighlightSection): string {
    const header = [
        `<div class="doc-section">`,
        `<div class="doc-header">`,
        `<h2>${escapeHtml(section.context.title)}</h2>`,
        section.context.meta ? `<div class="doc-meta">${section.context.meta}</div>` : '',
        `</div>`,
    ].join('\n');

    const cards = section.highlights
        .map((h) => renderHighlightCard(h, section.context.paragraphContents))
        .join('\n');

    return `${header}\n${cards}\n</div>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildHighlightsExportHtml(items: HighlightItem[]): Promise<string> {
    const grouped = groupByDocument(items);
    const sections: HighlightSection[] = [];

    for (const [, docItems] of grouped) {
        const context = await fetchDocumentContext(docItems);
        const highlights = deduplicateByGroup(docItems);
        sections.push({ context, highlights });
    }

    const title = i18n.t('Soulignages');
    const sectionHtml = sections.map(renderSection).join('\n');

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; padding: 32px 24px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 1.5em; font-weight: 700; padding-bottom: 10px; margin-bottom: 28px; border-bottom: 2px solid #e5e7eb; }
  .doc-section { margin-bottom: 36px; }
  .doc-header { padding: 10px 16px; margin-bottom: 14px; background: #f8f9fa; border-radius: 6px; }
  .doc-header h2 { font-size: 1.1em; font-weight: 600; margin: 0 0 2px; }
  .doc-meta { font-size: 0.85em; color: #6b7280; }
  .highlight-card { padding: 12px 16px; margin: 10px 0; background: #fff; border: 1px solid #f0f0f0; border-radius: 6px; page-break-inside: avoid; }
  .highlight-header { margin-bottom: 6px; }
  .paragraph-num { font-size: 0.8em; color: #9ca3af; font-weight: 600; letter-spacing: 0.02em; }
  .paragraph-content { margin: 0; line-height: 1.8; white-space: pre-wrap; color: #374151; }
  .highlight-snippet { margin: 0; line-height: 1.8; color: #374151; }
  .highlight-comment { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6; font-size: 0.85em; color: #6b7280; font-style: italic; }
  mark { padding: 1px 3px; border-radius: 3px; }
  @media print {
    body { padding: 16px; }
    .highlight-card { break-inside: avoid; }
  }
</style>
</head><body>
<h1>${escapeHtml(title)}</h1>
${sectionHtml}
</body></html>`;
}
