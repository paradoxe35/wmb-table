import * as referenceDataService from '@main/services/reference-data.service';
import i18n from '@main/lib/i18n';
import { escapeHtml } from '@shared/searchable';
import { formatDocumentTitle, isParagraphReference, type SubjectDocumentItem } from '@shared/types';

function formatDate(dateMs: number): string {
    return new Date(dateMs).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function renderDocumentRef(item: SubjectDocumentItem): string {
    const { documentReference } = item;
    const documentIdentity = documentReference.documentIdentity;
    const paragraphRef = isParagraphReference(documentReference) ? documentReference : null;
    const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex : null;
    const sermon =
        documentIdentity.documentType === 'sermon'
            ? referenceDataService.getSermonMeta(
                  documentIdentity.translationId,
                  documentIdentity.languageCode,
                  documentIdentity.sermonId,
              )
            : null;

    const typeLabel =
        documentIdentity.documentType === 'sermon'
            ? i18n.t('Prédication')
            : documentIdentity.documentType === 'custom'
              ? i18n.t('Document')
              : i18n.t('Référence');

    const lines: string[] = [`<div class="ref-card">`];
    const title = formatDocumentTitle(sermon?.title ?? item.documentTitle, documentIdentity);

    lines.push(
        `<div class="ref-header"><span class="ref-kind">${escapeHtml(typeLabel)}</span><div class="ref-title">${escapeHtml(title)}</div></div>`,
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
        `<div class="ref-header"><span class="ref-kind">${escapeHtml(i18n.t('Bible'))}</span><div class="ref-title">${escapeHtml(b.bookName)} ${b.chapter}:${b.verse}</div></div>`,
    ];
    if (b.content) {
        lines.push(`<div class="ref-body">${escapeHtml(b.content)}</div>`);
    }
    lines.push(`</div>`);
    return lines.join('\n');
}

export function buildSubjectExportHtml(name: string, items: SubjectDocumentItem[]): string {
    const body = items
        .map((item) =>
            item.documentReference.documentIdentity.documentType === 'bible'
                ? renderBibleRef(item)
                : renderDocumentRef(item),
        )
        .join('\n');

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${escapeHtml(name)}</title>
<style>
  body { font-family: sans-serif; font-size: 14px; padding: 20px; color: #333; line-height: 1.6; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px; }
  .ref-card { margin: 10px 0; padding: 12px 14px; border: 1px solid #e6e6e6; border-radius: 8px; page-break-inside: avoid; }
  .ref-header { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
  .ref-kind { display: inline-block; font-size: 0.72em; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #666; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; flex-shrink: 0; }
  .ref-title { font-weight: 600; font-size: 0.98em; }
  .ref-meta { margin-top: 4px; font-size: 0.85em; color: #6b7280; }
  .ref-body { margin-top: 6px; font-size: 0.9em; color: #444; line-height: 1.7; }
</style>
</head><body>
<h1>${escapeHtml(name)}</h1>
${body}
</body></html>`;
}
