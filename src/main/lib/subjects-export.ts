import * as referenceDataService from '@main/services/reference-data.service';
import { escapeHtml } from '@shared/searchable';
import { isParagraphReference, type SubjectDocumentItem } from '@shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateMs: number): string {
    return new Date(dateMs).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

// ---------------------------------------------------------------------------
// Card renderers
// ---------------------------------------------------------------------------

function renderSermonRef(item: SubjectDocumentItem): string {
    const paragraphRef = isParagraphReference(item.documentHtmlTree) ? item.documentHtmlTree : null;
    const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex + 1 : null;
    const lang = paragraphRef?.languageCode ?? 'en';
    const translationId = paragraphRef?.translationId ?? 0;
    const sermon = item.sermonId
        ? referenceDataService.getSermonMeta(translationId, lang, item.sermonId)
        : null;

    const lines: string[] = [`<div class="ref-card">`];

    lines.push(`<div class="ref-title">${escapeHtml(sermon?.title ?? item.documentTitle)}</div>`);

    if (sermon) {
        const parts: string[] = [];
        if (sermon.dateMs) parts.push(formatDate(sermon.dateMs));
        if (sermon.location) parts.push(escapeHtml(sermon.location));
        if (parts.length > 0) lines.push(`<div class="ref-meta">${parts.join(' — ')}</div>`);
    }

    if (item.textContent) {
        const prefix = paragraphNum != null ? `<strong>${paragraphNum}.</strong> ` : '';
        lines.push(`<div class="ref-body">${prefix}${escapeHtml(item.textContent)}</div>`);
    }

    lines.push(`</div>`);
    return lines.join('\n');
}

function renderBibleRef(item: SubjectDocumentItem): string {
    const b = item.bible!;
    const lines: string[] = [
        `<div class="ref-card">`,
        `<div class="ref-title">${escapeHtml(b.bookName)} ${b.chapter}:${b.verse}</div>`,
    ];
    if (b.content) {
        lines.push(`<div class="ref-body">${escapeHtml(b.content)}</div>`);
    }
    lines.push(`</div>`);
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildSubjectExportHtml(name: string, items: SubjectDocumentItem[]): string {
    const bibleRefs = items.filter((i) => i.bible);
    const sermonRefs = items.filter((i) => !i.bible);

    let body = '';

    if (sermonRefs.length > 0) {
        body += `<h2>Références</h2>\n`;
        body += sermonRefs.map(renderSermonRef).join('\n');
    }

    if (bibleRefs.length > 0) {
        body += `<h2>Références bibliques</h2>\n`;
        body += bibleRefs.map(renderBibleRef).join('\n');
    }

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${escapeHtml(name)}</title>
<style>
  body { font-family: sans-serif; font-size: 14px; padding: 20px; color: #333; line-height: 1.6; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { margin-top: 24px; font-size: 1.1em; color: #555; }
  .ref-card { margin: 8px 0; padding: 10px 12px; border: 1px solid #e6e6e6; border-radius: 4px; page-break-inside: avoid; }
  .ref-title { font-weight: 600; font-size: 0.95em; }
  .ref-meta { margin-top: 4px; font-size: 0.85em; color: #6b7280; }
  .ref-body { margin-top: 6px; font-size: 0.9em; color: #444; line-height: 1.7; }
</style>
</head><body>
<h1>${escapeHtml(name)}</h1>
<p style="color:#888;font-size:0.9em;">${items.length} référence(s)</p>
${body}
</body></html>`;
}
