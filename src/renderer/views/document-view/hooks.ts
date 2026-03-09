import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import type { MenuProps } from 'antd';
import {
    useSermonStore,
    useSearchStore,
    useAppStore,
    selectActiveTabTitle,
    selectActiveTabKey,
    selectActiveTab,
} from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';
import { buildHighlightRegex, strNormalizeNoLower } from '@renderer/utils/searchable';
import {
    type SermonContent as SermonContentType,
    type BibleBook,
    type ParagraphReference,
    type SearchMode,
    type HighlightItem,
    type HighlightParagraphRange,
    type DocumentType,
    isParagraphReference,
} from '@shared/types';
import {
    CHILD_PARENT_WINDOW_EVENT,
    DOCUMENT_CONTAINER_ID,
    HIGHLIGHT_EVENT,
} from '@renderer/utils/events';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';

// ---------------------------------------------------------------------------
// Content cache (avoids re-fetching on tab switches)
// ---------------------------------------------------------------------------
const contentCache = new Map<string, SermonContentType>();

export function useSermonContent() {
    const activeTab = useSermonStore(selectActiveTab);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const setActiveContent = useSermonStore((s) => s.setActiveContent);
    const activeContent = useSermonStore((s) => s.activeContent);
    const [loading, setLoading] = useState(false);

    const tabSermonId = activeTab?.sermonId;
    const tabTranslationId = activeTab?.translationId;
    const tabLanguage = activeTab?.languageCode ?? activeLanguage;

    useEffect(() => {
        if (!tabSermonId || !tabLanguage) {
            setActiveContent(null);
            return;
        }

        // For tabs in the current language, use sermonsById for metadata.
        // For foreign-language tabs, fetch content directly with translationId 0.
        const meta = sermonsById[tabSermonId];
        const translationId = tabTranslationId ?? meta?.translationId ?? 0;
        const cacheKey = `${tabLanguage}:${translationId}:${tabSermonId}`;
        const cached = contentCache.get(cacheKey);
        if (cached) {
            setActiveContent(cached);
            return;
        }
        setLoading(true);
        window.api.documents
            .getSermonContent(tabLanguage, translationId, tabSermonId)
            .then((content) => {
                contentCache.set(cacheKey, content);
                setActiveContent(content);
            })
            .catch((err) => {
                console.error('[useSermonContent] Failed to load:', err);
                setActiveContent(null);
            })
            .finally(() => setLoading(false));
    }, [tabSermonId, tabLanguage, sermonsById, setActiveContent, tabTranslationId]);

    return { content: activeContent, loading };
}

export function useScrollAndZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
    const activeTab = useSermonStore(selectActiveTab);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const activeTabKey = useSermonStore(selectActiveTabKey);

    const zoom = activeTab?.zoom ?? 100;

    useEffect(() => {
        if (!containerRef.current || !activeTab) return;
        containerRef.current.scrollTop = activeTab.scrollY ?? 0;
    }, [activeTabKey]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = debounce(() => {
            if (activeTabKey) {
                updateTabScroll(activeTabKey, el.scrollTop);
            }
        }, 500);
        el.addEventListener('scroll', handler as EventListener);
        return () => el.removeEventListener('scroll', handler as EventListener);
    }, [activeTabKey, updateTabScroll, containerRef]);

    return { zoom };
}

export function useSearchHighlight(): { term: string; mode: SearchMode } | null {
    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    return useMemo(() => {
        if (!activeTitle) return null;
        const query = documentViewQueries.find((q) => q.documentTitle === activeTitle);
        if (!query?.term) return null;
        return { term: query.term, mode: query.mode };
    }, [documentViewQueries, activeTitle]);
}

export function useReferenceNavigation(containerRef: React.RefObject<HTMLDivElement | null>) {
    const pendingNavigation = useSermonStore((s) => s.pendingNavigation);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const activeTab = useSermonStore(selectActiveTab);
    const activeContent = useSermonStore((s) => s.activeContent);

    useEffect(() => {
        if (!pendingNavigation || !activeTab) return;
        if (pendingNavigation.documentTitle !== activeTab.title) return;

        // Wait until the correct content is loaded (avoid scrolling in stale content from a previous tab)
        if (!activeContent || activeContent.meta.sermonId !== activeTab.sermonId) return;
        if (!containerRef.current) return;

        const ref = pendingNavigation.documentHtmlTree;
        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) {
            setPendingNavigation(null);
            return;
        }

        const tryScroll = () => scrollToParagraph(containerRef.current, paragraphIndex);

        if (tryScroll()) {
            setPendingNavigation(null);
            return;
        }

        // DOM may not have painted yet — retry after a short delay
        const timer = setTimeout(() => {
            tryScroll();
            setPendingNavigation(null);
        }, 300);
        return () => clearTimeout(timer);
    }, [pendingNavigation, activeTab, activeContent, setPendingNavigation]);
}

export function useContextMenuItems(
    content: SermonContentType | null,
    contextTargetRef: React.RefObject<Element | null>,
    documentType: DocumentType = 'sermon',
    bibleVerses?: BibleBook[],
): MenuProps['items'] {
    return useMemo(() => {
        if (!content) return [];

        const getRef = (): { ref: ParagraphReference; text: string } | null => {
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
                },
                text,
            };
        };

        const getSelectionParagraphs = (): HighlightParagraphRange[] | null => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
            const range = sel.getRangeAt(0);

            // Find all paragraph elements that intersect the selection
            const container = document.getElementById(DOCUMENT_CONTAINER_ID);
            if (!container) return null;
            const allParagraphs = Array.from(container.querySelectorAll('[data-paragraph-index]'));

            const result: HighlightParagraphRange[] = [];

            for (const pEl of allParagraphs) {
                if (!range.intersectsNode(pEl)) continue;
                const contentEl = pEl.querySelector('.paragraph-content') ?? pEl;
                const paragraphIndex = parseInt(pEl.getAttribute('data-paragraph-index')!);
                const pContent = content?.paragraphs.find(
                    (p) => p.paragraphIndex === paragraphIndex,
                );
                const contentLength =
                    pContent?.content.length ?? contentEl.textContent?.length ?? 0;

                // Compute start offset within this paragraph
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
                    // Selection starts inside or after this paragraph's content
                    const preRange = document.createRange();
                    preRange.selectNodeContents(contentEl);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    startOffset = preRange.toString().length;
                }

                // Compute end offset within this paragraph
                let endOffset = contentLength;
                const pRange = document.createRange();
                pRange.selectNodeContents(contentEl);
                if (range.compareBoundaryPoints(Range.END_TO_END, pRange) < 0) {
                    // Selection ends inside this paragraph
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

        /** For bible views, find the BibleBook matching the verse (paragraph index) */
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
                label: 'Copier',
                onClick: () => {
                    const result = getRef();
                    if (!result) return;
                    navigator.clipboard.writeText(result.text);
                    message.success('Texte copié');
                },
            },
            { type: 'divider' as const, key: 'divider-1' },
            {
                key: 'highlight-text',
                label: 'Souligner',
                onClick: () => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        message.warning('Sélectionnez du texte à souligner');
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
                label: 'Ajouter au sujet',
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
                          label: 'Ajouter à la note',
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
        ];
    }, [content, documentType, bibleVerses]);
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

export function useMatchNavigation(
    search: { term: string; mode: SearchMode } | null,
    paragraphs: string[],
) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    const { matchOffsets, total } = useMemo(() => {
        if (!search) return { matchOffsets: [] as number[], total: 0 };
        const regex = buildHighlightRegex(search.term, search.mode);
        if (!regex) return { matchOffsets: [] as number[], total: 0 };
        let cumulative = 0;
        const offsets: number[] = [];
        for (const text of paragraphs) {
            offsets.push(cumulative);
            regex.lastIndex = 0;
            const matches = [...strNormalizeNoLower(text).matchAll(regex)];
            cumulative += matches.length;
        }
        return { matchOffsets: offsets, total: cumulative };
    }, [search, paragraphs]);

    useEffect(() => {
        setTotalMatches(total);
        if (total === 0) setCurrentMatchIndex(0);
    }, [total, setTotalMatches, setCurrentMatchIndex]);

    useEffect(() => {
        if (total === 0) return;
        const el = document.querySelector(`[data-match-index="${currentMatchIndex}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [currentMatchIndex, total]);

    return { matchOffsets, total };
}
