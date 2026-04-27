import { message } from 'antd';
import type { MenuProps } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildParagraphReference } from '@shared/types';
import { resolveUiLanguage } from '@shared/constants';
import {
    type AddDocumentReferenceDetail,
    CHILD_PARENT_WINDOW_EVENT,
    DOCUMENT_CONTAINER_ID,
    HIGHLIGHT_EVENT,
    type OpenHighlightModalDetail,
    type ShowSimilarSermonsDetail,
} from '@renderer/utils/events';
import type {
    BibleBook,
    DocumentIdentity,
    DocumentType,
    HighlightItem,
    HighlightParagraphRange,
    ParagraphReference,
} from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { useThemeStore } from '@renderer/stores/theme.store';
import { formatDocumentSelectionForClipboard } from '../copy-format';

const PARAGRAPH_SELECTOR = '[data-paragraph-index]';

function parseParagraphIndex(el: Element): number {
    return parseInt(el.getAttribute('data-paragraph-index') ?? '0', 10);
}

function createContentRange(el: Element): Range {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r;
}

type ContextMenuContent = {
    documentTitle: string;
    documentIdentity: DocumentIdentity;
    languageCode: string;
    paragraphs: { paragraphIndex: number; content: string }[];
    sermonDateMs?: number;
    sermonTranslationId?: number;
    canPlayFromParagraph?: boolean;
    playFromParagraph?: (paragraphIndex: number) => void;
};

export function useContextMenuItems(
    content: ContextMenuContent | null,
    contextTargetRef: React.RefObject<Element | null>,
    documentType: DocumentType = 'sermon',
    bibleVerses?: BibleBook[],
): MenuProps['items'] {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const uiLanguagePreference = useThemeStore((s) => s.uiLanguagePreference);
    const fallbackLanguage = resolveUiLanguage(uiLanguagePreference, contentLanguage);

    return useMemo(() => {
        if (!content) return [];

        const { documentIdentity, documentTitle, languageCode, paragraphs } = content;

        const buildRef = (): { ref: ParagraphReference; text: string } | null => {
            const sel = window.getSelection();

            if (sel && !sel.isCollapsed) {
                const anchor = sel.anchorNode?.parentElement?.closest(PARAGRAPH_SELECTOR);
                return {
                    ref:
                        documentIdentity.documentType === 'sermon'
                            ? buildParagraphReference(
                                  documentIdentity,
                                  anchor ? parseParagraphIndex(anchor) : 0,
                                  sel.toString().slice(0, 200),
                              )
                            : buildParagraphReference(
                                  documentIdentity,
                                  anchor ? parseParagraphIndex(anchor) : 0,
                                  languageCode,
                                  sel.toString().slice(0, 200),
                              ),
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
                ref:
                    documentIdentity.documentType === 'sermon'
                        ? buildParagraphReference(documentIdentity, idx, text.slice(0, 200))
                        : buildParagraphReference(
                              documentIdentity,
                              idx,
                              languageCode,
                              text.slice(0, 200),
                          ),
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

        const getCopyParagraphs = (): HighlightParagraphRange[] | null => {
            const selectionParagraphs = getSelectionParagraphs();
            if (selectionParagraphs) {
                return selectionParagraphs;
            }

            const target = contextTargetRef.current;
            const paragraph = target instanceof Element ? target.closest(PARAGRAPH_SELECTOR) : null;
            if (!paragraph) return null;

            const paragraphIndex = parseParagraphIndex(paragraph);
            const content =
                paragraphs.find((p) => p.paragraphIndex === paragraphIndex)?.content ??
                paragraph.textContent ??
                '';

            return [{ paragraphIndex, startOffset: 0, endOffset: content.length }];
        };

        const getContextParagraphIndex = (): number | null => {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
                const anchor = sel.anchorNode?.parentElement?.closest(PARAGRAPH_SELECTOR);
                if (anchor) {
                    return parseParagraphIndex(anchor);
                }
            }

            const target = contextTargetRef.current;
            const paragraph = target instanceof Element ? target.closest(PARAGRAPH_SELECTOR) : null;
            return paragraph ? parseParagraphIndex(paragraph) : null;
        };

        const getBibleVerse = (paragraphIndex: number): BibleBook | undefined =>
            bibleVerses?.find((v) => +v.verse === paragraphIndex);

        const buildRefDetail = (result: { ref: ParagraphReference; text: string }) => {
            if (documentType === 'bible') {
                const verse = getBibleVerse(result.ref.paragraphIndex);
                if (verse) {
                    return {
                        documentTitle,
                        documentPreview: {
                            kind: 'bible-verse' as const,
                            bibleVerse: verse,
                        },
                        textContent: result.text,
                        documentReference: result.ref,
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
            return {
                documentTitle,
                documentReference: result.ref,
                textContent: displayText,
            };
        };

        // ----- Menu items -----

        const copyItem: MenuProps['items'] = [
            {
                key: 'copy-text',
                label: t('Copier'),
                onClick: async () => {
                    const copyParagraphs = getCopyParagraphs();
                    if (!copyParagraphs) {
                        return;
                    }
                    const text = formatDocumentSelectionForClipboard({
                        context: {
                            documentType,
                            documentTitle,
                            languageCode,
                            sermonDateMs: content.sermonDateMs,
                            fallbackLanguage,
                        },
                        paragraphs,
                        ranges: copyParagraphs,
                    });
                    try {
                        await navigator.clipboard.writeText(text);
                        message.success(t('Texte copié'));
                    } catch {
                        message.error(t('Impossible de copier le texte.'));
                    }
                },
            },
        ];

        const ttsItem: MenuProps['items'] =
            content.canPlayFromParagraph && content.playFromParagraph
                ? [
                      {
                          key: 'tts-play-from-here',
                          label: createElement(
                              'span',
                              { className: 'document-context-menu__item-with-icon' },
                              createElement('span', null, t("Lire à partir d'ici")),
                              createElement(SoundOutlined),
                          ),
                          onClick: () => {
                              const paragraphIndex = getContextParagraphIndex();
                              if (paragraphIndex == null) {
                                  return;
                              }
                              content.playFromParagraph?.(paragraphIndex);
                          },
                      },
                  ]
                : [];

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

                    const detail: OpenHighlightModalDetail = {
                        documentTitle,
                        documentIdentity,
                        paragraphs: selParagraphs,
                        textSnippet: ref.text.slice(0, 200),
                        languageCode,
                    };

                    window.dispatchEvent(
                        new CustomEvent<OpenHighlightModalDetail>(
                            CHILD_PARENT_WINDOW_EVENT.openHighlightModal,
                            { detail },
                        ),
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
                    const detail: AddDocumentReferenceDetail = buildRefDetail(ref);
                    window.dispatchEvent(
                        new CustomEvent<AddDocumentReferenceDetail>(
                            CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject,
                            { detail },
                        ),
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
                              const detail: AddDocumentReferenceDetail = buildRefDetail(ref);
                              window.dispatchEvent(
                                  new CustomEvent<AddDocumentReferenceDetail>(
                                      CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote,
                                      { detail },
                                  ),
                              );
                          },
                      },
                  ]
                : [];

        const hasSimilarSermonsContext =
            documentType === 'sermon' &&
            content.sermonDateMs != null &&
            content.sermonTranslationId != null;

        const similarItem: MenuProps['items'] = hasSimilarSermonsContext
            ? [
                  { type: 'divider' as const, key: 'divider-3' },
                  {
                      key: 'find-similar',
                      label: t('Trouver des prédications similaires'),
                      onClick: () => {
                          const ref = buildRef();
                          if (!ref) return;
                          const detail: ShowSimilarSermonsDetail = {
                              paragraphIndex: ref.ref.paragraphIndex,
                              translationId: content.sermonTranslationId!,
                              sermonDate: content.sermonDateMs!,
                              languageCode,
                              textSnippet: ref.text.slice(0, 200),
                          };
                          window.dispatchEvent(
                              new CustomEvent<ShowSimilarSermonsDetail>(
                                  CHILD_PARENT_WINDOW_EVENT.showSimilarSermons,
                                  { detail },
                              ),
                          );
                      },
                  },
              ]
            : [];

        return [
            ...copyItem,
            ...ttsItem,
            { type: 'divider' as const, key: 'divider-1' },
            ...highlightItem,
            { type: 'divider' as const, key: 'divider-2' },
            ...subjectItem,
            ...noteItem,
            ...similarItem,
        ];
    }, [content, contextTargetRef, documentType, bibleVerses, t, fallbackLanguage]);
}

export function useDocumentHighlights(documentIdentity: DocumentIdentity | undefined) {
    const [highlights, setHighlights] = useState<HighlightItem[]>([]);

    const fetchHighlights = useCallback(() => {
        if (!documentIdentity) {
            setHighlights([]);
            return;
        }
        window.api.highlights
            .getByDocument(documentIdentity)
            .then(setHighlights)
            .catch(() => setHighlights([]));
    }, [documentIdentity]);

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
