import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';
import {
    useAppStore,
    useCustomDocumentsStore,
    useDocumentTabsStore,
    selectActiveCustomTab,
    selectActiveDocumentIdentity,
    selectActiveTabKey,
} from '@renderer/stores';
import { useTts } from '@renderer/hooks/use-tts';
import { buildSegmentAnnouncement, getLanguageLabelNative } from '@shared/tts.types';
import { getDocumentIdentityKey } from '@shared/types';
import type { DocumentIdentity, HighlightItem } from '@shared/types';
import { parseCustomDocumentContent, type ReaderContent } from '../book-structure';
import {
    resolveCustomDocumentScrollPersistence,
    useCustomDocumentContent,
} from './document-content-hooks';
import {
    type ContextMenuCitation,
    useContextMenuItems,
    useDocumentHighlights,
} from './document-interaction-hooks';
import {
    type SearchHighlightState,
    useMatchNavigation,
    useReferenceNavigation,
    useSearchHighlight,
} from './document-navigation-hooks';
import { useScrollAndZoom, useScrolledPastTitle } from './document-scroll-hooks';

export type CustomDocumentReader = {
    loading: boolean;
    ready: boolean;
    documentId: string | null;
    title: string;
    documentIdentity: DocumentIdentity | null;
    ttsDocumentKey: string;
    containerRef: React.RefObject<HTMLDivElement | null>;
    contextTargetRef: React.MutableRefObject<Element | null>;
    zoom: number;
    content: ReaderContent;
    search: SearchHighlightState | null;
    activeParagraphIndex: number;
    highlightsByParagraph: Map<number, HighlightItem[]>;
    tts: ReturnType<typeof useTts>;
    contextMenuItems: MenuProps['items'];
    showCompactTitle: boolean;
};

export type BuildReaderCitation = (
    content: ReaderContent,
    target: { id: string; title: string } | null,
) => ContextMenuCitation | null;

/**
 * Everything a custom-document reader needs, shared by the plain and the book
 * views so that TTS, search, highlights, notes and reading position can only
 * ever behave one way.
 *
 * `buildCitation` is supplied by the book reader once it has parsed the
 * structure it is about to render.
 */
export function useCustomDocumentReader(buildCitation?: BuildReaderCitation): CustomDocumentReader {
    const activeTab = useDocumentTabsStore(selectActiveCustomTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    const activeCustomDocumentId = activeTab?.documentId;
    const customDoc = useCustomDocumentsStore((s) =>
        activeCustomDocumentId
            ? s.customDocuments.find((document) => document.id === activeCustomDocumentId)
            : undefined,
    );

    const ttsDocumentKey = activeDocumentIdentity
        ? getDocumentIdentityKey(activeDocumentIdentity)
        : '';

    const { content: docContent, loading } = useCustomDocumentContent(
        customDoc?.id,
        customDoc?.languageCode,
    );
    const { restoreIdentity, readingPositionKey } = resolveCustomDocumentScrollPersistence(
        customDoc?.id,
        docContent?.id,
    );

    useReferenceNavigation(containerRef, {
        contentReady: !!docContent,
        documentIdentity: customDoc ? activeDocumentIdentity : null,
    });
    const { zoom } = useScrollAndZoom(containerRef, {
        contentReady: !!docContent,
        restoreIdentity,
        readingPositionKey,
    });

    const content = useMemo(
        () => parseCustomDocumentContent(docContent?.content ?? ''),
        [docContent?.content],
    );

    const { activeParagraphIndex } = useMatchNavigation(
        containerRef,
        activeTabKey,
        search,
        content.paragraphs,
        !!restoreIdentity,
    );

    const docLang = docContent?.languageCode ?? contentLanguage ?? 'en';
    const { highlightsByParagraph } = useDocumentHighlights(
        customDoc ? (activeDocumentIdentity ?? undefined) : undefined,
    );

    const tts = useTts(content.paragraphs, docLang, ttsDocumentKey, {
        introText: docContent?.title,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, docLang),
    });

    const showCompactTitle = useScrolledPastTitle(containerRef, !!docContent);

    // Disable TTS when document language doesn't match the active content language
    const effectiveTts = useMemo(() => {
        const langMismatch =
            !!docContent?.languageCode &&
            !!contentLanguage &&
            docContent.languageCode !== contentLanguage;
        const activeLanguageLabel = contentLanguage
            ? getLanguageLabelNative(contentLanguage)
            : undefined;

        if (!langMismatch) {
            return tts;
        }

        return {
            ...tts,
            canSpeak: false,
            incompatibleMessage: t(
                'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.',
                { language: activeLanguageLabel ?? contentLanguage ?? '' },
            ),
        };
    }, [tts, docContent?.languageCode, contentLanguage, t]);

    const documentId = docContent?.id ?? null;
    const documentTitle = docContent?.title ?? '';
    const citation = useMemo(
        () =>
            buildCitation?.(
                content,
                documentId ? { id: documentId, title: documentTitle } : null,
            ) ?? null,
        [buildCitation, content, documentId, documentTitle],
    );

    const contextMenuContent = useMemo(() => {
        if (!docContent || !customDoc || !activeDocumentIdentity) {
            return null;
        }

        return {
            documentTitle: docContent.title,
            documentIdentity: activeDocumentIdentity,
            languageCode: docLang,
            paragraphs: content.paragraphs,
            canPlayFromParagraph: effectiveTts.canSpeak,
            playFromParagraph: effectiveTts.playFromParagraph,
            ...(citation ? { citation } : {}),
        };
    }, [
        docContent,
        customDoc,
        activeDocumentIdentity,
        docLang,
        content.paragraphs,
        effectiveTts,
        citation,
    ]);

    const contextMenuItems = useContextMenuItems(contextMenuContent, contextTargetRef, 'custom');

    return {
        loading,
        ready: !!docContent,
        documentId,
        title: docContent?.title ?? '',
        documentIdentity: activeDocumentIdentity,
        ttsDocumentKey,
        containerRef,
        contextTargetRef,
        zoom,
        content,
        search,
        activeParagraphIndex,
        highlightsByParagraph,
        tts: effectiveTts,
        contextMenuItems,
        showCompactTitle,
    };
}
