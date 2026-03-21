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
    DocumentType,
    HighlightItem,
    HighlightParagraphRange,
    ParagraphReference,
    SermonContent,
} from '@shared/types';

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

        const getRef = (): { ref: ParagraphReference; text: string } | null => {
            const [bibleBook, bibleChapter] =
                documentType === 'bible'
                    ? content.meta.sermonId.split(':')
                    : [undefined, undefined];
            const referenceMeta = {
                documentType,
                sermonId: content.meta.sermonId,
                customDocumentId: documentType === 'custom' ? content.meta.id : undefined,
                bibleBook,
                bibleChapter,
                bibleVersionAbbreviation,
            };

            const sel = window.getSelection();

            if (sel && !sel.isCollapsed) {
                const anchor = sel.anchorNode?.parentElement?.closest('[data-paragraph-index]');
                const idx = anchor ? parseInt(anchor.getAttribute('data-paragraph-index')!) : 0;
                return {
                    ref: {
                        paragraphIndex: idx,
                        translationId: content.meta.translationId,
                        languageCode: content.meta.languageCode,
                        textSnippet: sel.toString().slice(0, 200),
                        ...referenceMeta,
                    },
                    text: sel.toString(),
                };
            }

            const target = contextTargetRef.current;
            const paragraph =
                target instanceof Element ? target.closest('[data-paragraph-index]') : null;
            if (!paragraph) return null;

            const idx = parseInt(paragraph.getAttribute('data-paragraph-index')!);
            const paragraphData = content.paragraphs.find((p) => p.paragraphIndex === idx);
            const text = paragraphData?.content ?? paragraph.textContent ?? '';

            return {
                ref: {
                    paragraphIndex: idx,
                    translationId: content.meta.translationId,
                    languageCode: content.meta.languageCode,
                    textSnippet: text.slice(0, 200),
                    ...referenceMeta,
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
            const allParagraphs = Array.from(container.querySelectorAll('[data-paragraph-index]'));

            const result: HighlightParagraphRange[] = [];

            for (const pEl of allParagraphs) {
                if (!range.intersectsNode(pEl)) continue;
                const contentEl = pEl.querySelector('.paragraph-content') ?? pEl;
                const paragraphIndex = parseInt(pEl.getAttribute('data-paragraph-index')!);
                const pContent = content.paragraphs.find(
                    (p) => p.paragraphIndex === paragraphIndex,
                );
                const contentLength =
                    pContent?.content.length ?? contentEl.textContent?.length ?? 0;

                let startOffset = 0;
                if (
                    range.compareBoundaryPoints(
                        Range.START_TO_START,
                        (() => {
                            const r = document.createRange();
                            r.selectNodeContents(contentEl);
                            return r;
                        })(),
                    ) > 0
                ) {
                    const preRange = document.createRange();
                    preRange.selectNodeContents(contentEl);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    startOffset = preRange.toString().length;
                }

                let endOffset = contentLength;
                const pRange = document.createRange();
                pRange.selectNodeContents(contentEl);
                if (range.compareBoundaryPoints(Range.END_TO_END, pRange) < 0) {
                    const preRange = document.createRange();
                    preRange.selectNodeContents(contentEl);
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
                if (verse) return { bible: verse, textContent: result.text };
            }
            return { documentHtmlTree: result.ref, textContent: result.text };
        };

        return [
            {
                key: 'copy-text',
                label: t('Copier'),
                onClick: () => {
                    const result = getRef();
                    if (!result) return;
                    navigator.clipboard.writeText(result.text);
                    message.success(t('Texte copié'));
                },
            },
            { type: 'divider' as const, key: 'divider-1' },
            {
                key: 'highlight-text',
                label: t('Souligner'),
                onClick: () => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        message.warning(t('Sélectionnez du texte à souligner'));
                        return;
                    }
                    const paragraphs = getSelectionParagraphs();
                    const result = getRef();
                    if (!paragraphs || !result) return;
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.openHighlightModal, {
                            detail: {
                                documentTitle: content.meta.title,
                                sermonId: content.meta.sermonId,
                                paragraphs,
                                textSnippet: result.text.slice(0, 200),
                                translationId: content.meta.translationId,
                                languageCode: content.meta.languageCode,
                                documentType,
                            },
                        }),
                    );
                },
            },
            { type: 'divider' as const, key: 'divider-2' },
            {
                key: 'add-to-subject',
                label: t('Ajouter au sujet'),
                onClick: () => {
                    const result = getRef();
                    if (!result) return;
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, {
                            detail: buildRefDetail(result),
                        }),
                    );
                },
            },
            ...(documentType !== 'bible'
                ? [
                      {
                          key: 'add-to-note',
                          label: t('Ajouter à la note'),
                          onClick: () => {
                              const result = getRef();
                              if (!result) return;
                              window.dispatchEvent(
                                  new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, {
                                      detail: buildRefDetail(result),
                                  }),
                              );
                          },
                      },
                  ]
                : []),
            ...(documentType === 'sermon'
                ? [
                      { type: 'divider' as const, key: 'divider-3' },
                      {
                          key: 'find-similar',
                          label: t('Trouver des prédications similaires'),
                          onClick: () => {
                              const result = getRef();
                              if (!result) return;
                              window.dispatchEvent(
                                  new CustomEvent(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, {
                                      detail: {
                                          paragraphIndex: result.ref.paragraphIndex,
                                          translationId: content.meta.translationId,
                                          sermonDate: content.meta.dateMs,
                                          languageCode: content.meta.languageCode,
                                          textSnippet: result.text.slice(0, 200),
                                      },
                                  }),
                              );
                          },
                      },
                  ]
                : []),
        ];
    }, [content, contextTargetRef, documentType, bibleVerses, bibleVersionAbbreviation, t]);
}

export function useDocumentHighlights(documentTitle: string | null, sermonId: string | undefined) {
    const [highlights, setHighlights] = useState<HighlightItem[]>([]);

    const fetchHighlights = useCallback(() => {
        if (!documentTitle) {
            setHighlights([]);
            return;
        }
        window.api.highlights
            .getByDocument(documentTitle, sermonId ?? '')
            .then(setHighlights)
            .catch(() => setHighlights([]));
    }, [documentTitle, sermonId]);

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
