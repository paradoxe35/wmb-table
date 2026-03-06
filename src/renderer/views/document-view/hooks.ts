import React, { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import type { MenuProps } from 'antd';
import {
    useSermonStore,
    useSearchStore,
    useSubjectsStore,
    useAppStore,
    selectActiveTabTitle,
    selectActiveTab,
} from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';
import { simpleRegExp } from '@renderer/utils/searchable';
import {
    type SermonContent as SermonContentType,
    type ParagraphReference,
    isParagraphReference,
} from '@shared/types';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

// ---------------------------------------------------------------------------
// Content cache (avoids re-fetching on tab switches)
// ---------------------------------------------------------------------------
const contentCache = new Map<string, SermonContentType>();

export function useSermonContent() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const activeTab = useSermonStore(selectActiveTab);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);
    const setActiveContent = useSermonStore((s) => s.setActiveContent);
    const activeContent = useSermonStore((s) => s.activeContent);
    const [loading, setLoading] = useState(false);

    const tabTranslationId = activeTab?.translationId;

    useEffect(() => {
        if (!activeTitle || !activeLanguage) {
            setActiveContent(null);
            return;
        }
        const meta = sermonsByTitle[activeTitle];
        if (!meta) {
            setActiveContent(null);
            return;
        }
        const translationId = tabTranslationId ?? meta.translationId;
        const cacheKey = `${activeLanguage}:${translationId}:${meta.sermonDate}`;
        const cached = contentCache.get(cacheKey);
        if (cached) {
            setActiveContent(cached);
            return;
        }
        setLoading(true);
        window.api.documents
            .getSermonContent(activeLanguage, translationId, meta.sermonDate)
            .then((content) => {
                contentCache.set(cacheKey, content);
                setActiveContent(content);
            })
            .catch((err) => {
                console.error('[useSermonContent] Failed to load:', err);
                setActiveContent(null);
            })
            .finally(() => setLoading(false));
    }, [activeTitle, activeLanguage, sermonsByTitle, setActiveContent, tabTranslationId]);

    return { content: activeContent, loading };
}

export function useScrollAndZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
    const activeTab = useSermonStore(selectActiveTab);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    const zoom = activeTab?.zoom ?? 100;

    useEffect(() => {
        if (!containerRef.current || !activeTab) return;
        containerRef.current.scrollTop = activeTab.scrollY ?? 0;
    }, [activeTitle]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = debounce(() => {
            if (activeTitle) {
                updateTabScroll(activeTitle, el.scrollTop);
            }
        }, 500);
        el.addEventListener('scroll', handler as EventListener);
        return () => el.removeEventListener('scroll', handler as EventListener);
    }, [activeTitle, updateTabScroll]);

    return { zoom };
}

export function useSearchHighlight(): string | null {
    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    return useMemo(() => {
        if (!activeTitle) return null;
        const query = documentViewQueries.find((q) => q.documentTitle === activeTitle);
        return query?.term ?? null;
    }, [documentViewQueries, activeTitle]);
}

export function useSubjectNavigation(containerRef: React.RefObject<HTMLDivElement | null>) {
    const selectedSubjectItem = useSubjectsStore((s) => s.selectedSubjectItem);
    const setSelectedSubjectItem = useSubjectsStore((s) => s.setSelectedSubjectItem);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    useEffect(() => {
        if (!selectedSubjectItem || !containerRef.current) return;
        if (selectedSubjectItem.documentTitle !== activeTitle) return;

        const ref = selectedSubjectItem.documentHtmlTree;
        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) return;

        const el = containerRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSelectedSubjectItem(null);
    }, [selectedSubjectItem, activeTitle, setSelectedSubjectItem]);
}

export function useContextMenuItems(content: SermonContentType | null): MenuProps['items'] {
    return useMemo(() => {
        if (!content) return [];

        const getSelectionRef = (): { sel: Selection; ref: ParagraphReference } | null => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) {
                message.warning('Aucun texte sélectionné');
                return null;
            }
            const anchor = sel.anchorNode?.parentElement?.closest('[data-paragraph-index]');
            const idx = anchor ? parseInt(anchor.getAttribute('data-paragraph-index')!) : 0;
            return {
                sel,
                ref: {
                    paragraphIndex: idx,
                    translationId: content.meta.translationId,
                    languageCode: content.meta.languageCode,
                    textSnippet: sel.toString().slice(0, 200),
                },
            };
        };

        return [
            {
                key: 'add-to-subject',
                label: 'Ajouter au sujet',
                onClick: () => {
                    const result = getSelectionRef();
                    if (!result) return;
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, {
                            detail: {
                                documentHtmlTree: result.ref,
                                textContent: result.sel.toString(),
                            },
                        }),
                    );
                },
            },
            {
                key: 'add-to-note',
                label: 'Ajouter à la note',
                onClick: () => {
                    const result = getSelectionRef();
                    if (!result) return;
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, {
                            detail: {
                                documentHtmlTree: result.ref,
                                textContent: result.sel.toString(),
                            },
                        }),
                    );
                },
            },
        ];
    }, [content]);
}

export function useMatchNavigation(searchTerm: string | null, paragraphs: string[]) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    const { matchOffsets, total } = useMemo(() => {
        if (!searchTerm) return { matchOffsets: [] as number[], total: 0 };
        const regex = simpleRegExp(searchTerm);
        let cumulative = 0;
        const offsets: number[] = [];
        for (const text of paragraphs) {
            offsets.push(cumulative);
            const matches = text.match(regex);
            cumulative += matches?.length ?? 0;
        }
        return { matchOffsets: offsets, total: cumulative };
    }, [searchTerm, paragraphs]);

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
