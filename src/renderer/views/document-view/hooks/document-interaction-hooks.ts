import { message } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CHILD_PARENT_WINDOW_EVENT,
    DOCUMENT_CONTAINER_ID,
    HIGHLIGHT_EVENT,
} from '@renderer/utils/events';
import type {
    BibleBook,
    DocumentIdentity,
    DocumentType,
    HighlightItem,
    HighlightParagraphRange,
    ParagraphReference,
    SermonContent,
} from '@shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PARAGRAPH_SELECTOR = '[data-paragraph-index]';

function parseParagraphIndex(el: Element): number {
    return parseInt(el.getAttribute('data-paragraph-index') ?? '0', 10);
}

function createContentRange(el: Element): Range {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r;
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export function useContextMenuItems(
    content: SermonContent | null,
    contextTargetRef: React.RefObject<Element | null>,
    documentType: DocumentType = 'sermon',
    bibleVerses?: BibleBook[],
    bibleVersionAbbreviation?: string,
): MenuProps['items'] {
    const { t } = useTranslation();

    return useMemo(() => {
        if (!content) return [];

        const { meta, paragraphs } = content;
        const bibleBook = documentType === 'bible' ? bibleVerses?.[0]?.book : undefined;
        const bibleChapter = documentType === 'bible' ? bibleVerses?.[0]?.chapter : undefined;
        const documentIdentity: DocumentIdentity =
            documentType === 'custom'
                ? {
                      documentType: 'custom',
                      customDocumentId: meta.id,
                  }
                : documentType === 'bible'
                  ? {
                        documentType: 'bible',
                        bibleBook: bibleBook ?? '',
                        bibleChapter: bibleChapter ?? '',
                        bibleVersionAbbreviation,
                    }
                  : {
                        documentType: 'sermon',
                        sermonId: meta.sermonId,
                        translationId: meta.translationId,
                    };

        const buildRef = (): { ref: ParagraphReference; text: string } | null => {
            const sel = window.getSelection();

            if (sel && !sel.isCollapsed) {
                const anchor = sel.anchorNode?.parentElement?.closest(PARAGRAPH_SELECTOR);
                return {
                    ref: {
                        paragraphIndex: anchor ? parseParagraphIndex(anchor) : 0,
                        translationId: meta.translationId,
                        languageCode: meta.languageCode,
                        textSnippet: sel.toString().slice(0, 200),
                        documentIdentity,
                    },
                    text: sel.toString(),
                };
            }

            const target = contextTargetRef.current;
            const paragraph = target instanceof Element ? target.closest(PARAGRAPH_SELECTOR) : null;
            if (!paragraph) return null;

            const idx = parseParagraphIndex(paragraph);
            const text =
                paragraphs.find((p) => p.paragraphIndex === idx)?.content ??
                paragraph.textContent ??
                '';

            return {
                ref: {
                    paragraphIndex: idx,
                    translationId: meta.translationId,
                    languageCode: meta.languageCode,
                    textSnippet: text.slice(0, 200),
                    documentIdentity,
                },
                text,
            };
        };

        const getSelectionParagraphs = (): HighlightParagraphRange[] | null => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
            const range = sel.getRangeAt(0);
            const container = document.getElementById(DOCUMENT_CONTAINER_ID);
            if (!container) return null;

            const result: HighlightParagraphRange[] = [];

            for (const pEl of container.querySelectorAll(PARAGRAPH_SELECTOR)) {
                if (!range.intersectsNode(pEl)) continue;
                const contentEl = pEl.querySelector('.paragraph-content') ?? pEl;
                const paragraphIndex = parseParagraphIndex(pEl);
                const contentLength =
                    paragraphs.find((p) => p.paragraphIndex === paragraphIndex)?.content.length ??
                    contentEl.textContent?.length ??
                    0;

                let startOffset = 0;
                const contentRange = createContentRange(contentEl);
                if (range.compareBoundaryPoints(Range.START_TO_START, contentRange) > 0) {
                    const preRange = createContentRange(contentEl);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    startOffset = preRange.toString().length;
                }

                let endOffset = contentLength;
                if (range.compareBoundaryPoints(Range.END_TO_END, contentRange) < 0) {
                    const preRange = createContentRange(contentEl);
                    preRange.setEnd(range.endContainer, range.endOffset);
                    endOffset = preRange.toString().length;
                }

                if (endOffset > startOffset) {
                    result.push({ paragraphIndex, startOffset, endOffset });
                }
            }

            return result.length > 0 ? result : null;
        };

        const getBibleVerse = (paragraphIndex: number): BibleBook | undefined =>
            bibleVerses?.find((v) => +v.verse === paragraphIndex);

        const buildRefDetail = (result: { ref: ParagraphReference; text: string }) => {
            if (documentType === 'bible') {
                const verse = getBibleVerse(result.ref.paragraphIndex);
                if (verse) {
                    return {
                        documentPreview: {
                            kind: 'bible-verse' as const,
                            bibleVerse: verse,
                        },
                        textContent: result.text,
                        documentHtmlTree: result.ref,
                        documentIdentity,
                    };
                }
            }
            // Include full paragraph content so the subject view can detect
            // whether the textContent is a mid-paragraph selection (show "...")
            const fullParagraph =
                paragraphs.find((p) => p.paragraphIndex === result.ref.paragraphIndex)?.content ??
                '';
            const isPartialSelection = fullParagraph !== result.text && result.text.length > 0;
            const displayText = isPartialSelection
                ? (fullParagraph.startsWith(result.text) ? '' : '...') + result.text
                : result.text;
            return { documentHtmlTree: result.ref, textContent: displayText, documentIdentity };
        };

        // ----- Menu items -----

        const copyItem: MenuProps['items'] = [
            {
                key: 'copy-text',
                label: t('Copier'),
                onClick: () => {
                    const ref = buildRef();
                    if (!ref) return;
                    navigator.clipboard.writeText(ref.text);
                    message.success(t('Texte copié'));
                },
            },
        ];

        const highlightItem: MenuProps['items'] = [
            {
                key: 'highlight-text',
                label: t('Souligner'),
                onClick: () => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        message.warning(t('Sélectionnez du texte à souligner'));
                        return;
                    }
                    const selParagraphs = getSelectionParagraphs();
                    const ref = buildRef();
                    if (!selParagraphs || !ref) {
                        return;
                    }

                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.openHighlightModal, {
                            detail: {
                                documentTitle: meta.title,
                                documentIdentity,
                                paragraphs: selParagraphs,
                                textSnippet: ref.text.slice(0, 200),
                                languageCode: meta.languageCode,
                            },
                        }),
                    );
                },
            },
        ];

        const subjectItem: MenuProps['items'] = [
            {
                key: 'add-to-subject',
                label: t('Ajouter au sujet'),
                onClick: () => {
                    const ref = buildRef();
                    if (!ref) return;
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, {
                            detail: buildRefDetail(ref),
                        }),
                    );
                },
            },
        ];

        const noteItem: MenuProps['items'] =
            documentType !== 'bible'
                ? [
                      {
                          key: 'add-to-note',
                          label: t('Ajouter à la note'),
                          onClick: () => {
                              const ref = buildRef();
                              if (!ref) return;
                              window.dispatchEvent(
                                  new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, {
                                      detail: buildRefDetail(ref),
                                  }),
                              );
                          },
                      },
                  ]
                : [];

        const similarItem: MenuProps['items'] =
            documentType === 'sermon' && meta.dateMs
                ? [
                      { type: 'divider' as const, key: 'divider-3' },
                      {
                          key: 'find-similar',
                          label: t('Trouver des prédications similaires'),
                          onClick: () => {
                              const ref = buildRef();
                              if (!ref) return;
                              window.dispatchEvent(
                                  new CustomEvent(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, {
                                      detail: {
                                          paragraphIndex: ref.ref.paragraphIndex,
                                          translationId: meta.translationId,
                                          sermonDate: meta.dateMs,
                                          languageCode: meta.languageCode,
                                          textSnippet: ref.text.slice(0, 200),
                                      },
                                  }),
                              );
                          },
                      },
                  ]
                : [];

        return [
            ...copyItem,
            { type: 'divider' as const, key: 'divider-1' },
            ...highlightItem,
            { type: 'divider' as const, key: 'divider-2' },
            ...subjectItem,
            ...noteItem,
            ...similarItem,
        ];
    }, [content, contextTargetRef, documentType, bibleVerses, bibleVersionAbbreviation, t]);
}

// ---------------------------------------------------------------------------
// Document highlights
// ---------------------------------------------------------------------------

export function useDocumentHighlights(
    documentTitle: string | null,
    documentIdentity: DocumentIdentity | undefined,
) {
    const [highlights, setHighlights] = useState<HighlightItem[]>([]);

    const fetchHighlights = useCallback(() => {
        if (!documentTitle || !documentIdentity) {
            setHighlights([]);
            return;
        }
        window.api.highlights
            .getByDocument(documentTitle, documentIdentity)
            .then(setHighlights)
            .catch(() => setHighlights([]));
    }, [documentTitle, documentIdentity]);

    useEffect(() => {
        fetchHighlights();
    }, [fetchHighlights]);

    useEffect(() => {
        const handler = () => fetchHighlights();
        window.addEventListener(HIGHLIGHT_EVENT.highlightsUpdated, handler);
        return () => window.removeEventListener(HIGHLIGHT_EVENT.highlightsUpdated, handler);
    }, [fetchHighlights]);

    const highlightsByParagraph = useMemo(() => {
        const map = new Map<number, HighlightItem[]>();
        for (const h of highlights) {
            const arr = map.get(h.paragraphIndex) ?? [];
            arr.push(h);
            map.set(h.paragraphIndex, arr);
        }
        return map;
    }, [highlights]);

    return { highlights, highlightsByParagraph };
}
