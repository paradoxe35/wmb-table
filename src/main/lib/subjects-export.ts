import * as referenceDataService from '@main/services/reference-data.service';
import i18n from '@main/lib/i18n';
import { escapeHtml } from '@shared/searchable';
import {
    isParagraphReference,
    resolveDocumentTitle,
    type SubjectDocumentItem,
} from '@shared/types';

function formatDate(dateMs: number): string {
    return new Date(dateMs).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function renderSermonRef(item: SubjectDocumentItem): string {
    const { documentReference } = item;
    const documentIdentity = documentReference.documentIdentity;
    const paragraphRef = isParagraphReference(documentReference) ? documentReference : null;
    const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex : null;
    const lang = paragraphRef?.languageCode ?? 'en';
    const sermon =
        documentIdentity.documentType === 'sermon'
            ? referenceDataService.getSermonMeta(
                  documentIdentity.translationId,
                  lang,
                  documentIdentity.sermonId,
              )
            : null;

    const lines: string[] = [`<div class="ref-card">`];

    lines.push(
        `<div class="ref-title">${escapeHtml(resolveDocumentTitle(item.documentTitle, documentIdentity, sermon?.title))}</div>`,
    );

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
    const b = item.documentPreview?.kind === 'bible-verse' ? item.documentPreview.bibleVerse : null;
    if (!b) return '';
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

export function buildSubjectExportHtml(name: string, items: SubjectDocumentItem[]): string {
    const bibleRefs = items.filter(({ documentReference }) => {
        const documentIdentity = documentReference.documentIdentity;
        return documentIdentity.documentType === 'bible';
    });
    const sermonRefs = items.filter(({ documentReference }) => {
        const documentIdentity = documentReference.documentIdentity;
        return documentIdentity.documentType === 'sermon';
    });
    const otherRefs = items.filter(({ documentReference }) => {
        const documentIdentity = documentReference.documentIdentity;
        return (
            documentIdentity.documentType !== 'bible' && documentIdentity.documentType !== 'sermon'
        );
    });
    const hasBothTypes = bibleRefs.length > 0 && sermonRefs.length > 0;

    let body = '';

    if (sermonRefs.length > 0) {
        if (hasBothTypes) {
            body += `<h2>${escapeHtml(i18n.t('Prédications'))}</h2>\n`;
        }
        body += sermonRefs.map(renderSermonRef).join('\n');
    }

    if (bibleRefs.length > 0) {
        if (hasBothTypes) {
            body += `<h2>${escapeHtml(i18n.t('Bible'))}</h2>\n`;
        }
        body += bibleRefs.map(renderBibleRef).join('\n');
    }

    if (otherRefs.length > 0) {
        body += otherRefs.map(renderSermonRef).join('\n');
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
${body}
</body></html>`;
}
