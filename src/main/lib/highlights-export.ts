import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import * as bibleRepo from '@main/database/repositories/bible.repository';
import * as customDocRepo from '@main/database/repositories/custom-documents.repository';
import { escapeHtml } from '@shared/searchable';
import type { HighlightItem } from '@shared/types';

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
        const key = `${item.documentType}::${item.documentTitle}::${item.sermonId}`;
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
    return new Date(dateMs).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

async function fetchSermonContext(first: HighlightItem): Promise<Partial<DocumentContext>> {
    const paragraphContents = new Map<number, string>();
    let meta: string | undefined;

    const sermon = referenceDataService.getSermonMeta(
        first.translationId,
        first.languageCode,
        first.sermonId,
    );
    if (!sermon) {
        return { paragraphContents };
    }

    const parts: string[] = [];
    if (sermon.dateMs) parts.push(formatDate(sermon.dateMs));
    if (sermon.location) parts.push(escapeHtml(sermon.location));
    if (sermon.traductionName) parts.push(`Traduction: ${escapeHtml(sermon.traductionName)}`);
    if (parts.length > 0) meta = parts.join(' — ');

    try {
        const paragraphs = await tantivyService.getSermonParagraphs(
            first.languageCode,
            first.translationId,
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
    const [bookCode, chapter] = first.sermonId.split(':');
    if (bookCode && chapter) {
        const verses = bibleRepo.getBooks({ book: bookCode, chapter });
        for (const v of verses) paragraphContents.set(+v.verse, v.content);
    }
    return { paragraphContents };
}

function fetchCustomDocContext(first: HighlightItem): Partial<DocumentContext> {
    const paragraphContents = new Map<number, string>();
    const doc = customDocRepo.getCustomDocumentContent(first.sermonId);
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

    if (first.documentType === 'sermon') {
        partial = await fetchSermonContext(first);
    } else if (first.documentType === 'bible') {
        partial = fetchBibleContext(first);
    } else if (first.documentType === 'custom') {
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
    return `${before}<mark style="background:${escapeHtml(color)}40;">${marked}</mark>${after}`;
}

function renderHighlightCard(
    h: DeduplicatedHighlight,
    paragraphContents: Map<number, string>,
): string {
    const fullContent = paragraphContents.get(h.paragraphIndex);
    const lines: string[] = [`<div class="highlight-card">`];

    // Header: color dot + paragraph number
    lines.push(
        `<div class="highlight-header">` +
            `<span class="color-dot" style="background:${escapeHtml(h.color)};"></span>` +
            (h.paragraphIndex > 0 ? `<span class="paragraph-num">${h.paragraphIndex}</span>` : '') +
            `</div>`,
    );

    // Content: full paragraph with mark, or just the snippet
    if (fullContent) {
        lines.push(
            `<p class="paragraph-content">${renderParagraphWithMark(fullContent, h.textSnippet, h.color)}</p>`,
        );
    } else {
        lines.push(
            `<p class="highlight-snippet"><mark style="background:${escapeHtml(h.color)}40;">${escapeHtml(h.textSnippet)}</mark></p>`,
        );
    }

    if (h.comment) {
        lines.push(`<p class="highlight-comment">${escapeHtml(h.comment)}</p>`);
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

    const sectionHtml = sections.map(renderSection).join('\n');

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Soulignages</title>
<style>
  body { font-family: sans-serif; font-size: 14px; padding: 20px; color: #333; line-height: 1.6; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
  .doc-section { margin-bottom: 32px; }
  .doc-header { text-align: center; padding: 12px 0 8px; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
  .doc-header h2 { font-size: 1.3em; font-weight: 600; margin: 0 0 4px; }
  .doc-meta { font-size: 0.9em; color: #6b7280; margin: 2px 0; }
  .highlight-card { padding: 10px 12px; margin: 8px 0; border: 1px solid #e6e6e6; border-radius: 4px; page-break-inside: avoid; }
  .highlight-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .color-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; border: 1px solid #ccc; }
  .paragraph-num { font-family: monospace; font-size: 0.85em; color: #6b7280; font-weight: 600; }
  .paragraph-content { margin: 0; line-height: 1.8; white-space: pre-wrap; }
  .highlight-snippet { margin: 0; line-height: 1.8; }
  .highlight-comment { margin: 6px 0 0; font-size: 0.85em; color: #666; font-style: italic; }
  mark { padding: 1px 2px; border-radius: 2px; }
</style>
</head><body>
<h1>Soulignages</h1>
${sectionHtml}
</body></html>`;
}
