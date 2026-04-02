import { useCallback, useState } from 'react';
import { List, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TantivySearchHit, SearchSnippet, SearchMode } from '@shared/types';
import { buildSermonDocumentIdentity, getTabKey } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import HighlightedText from '@renderer/components/highlighted-text';
import { useAppStore, useSearchStore } from '@renderer/stores';
import { useDocumentPresentation } from '@renderer/hooks';

const { Text } = Typography;

const INITIAL_SNIPPETS = 2;

function SnippetRow({
    snippet,
    query,
    searchMode,
    hitTitle,
    sermonId,
    translationId,
    languageCode,
    onNavigate,
}: {
    snippet: SearchSnippet;
    query: string;
    searchMode: SearchMode;
    hitTitle: string;
    sermonId: string;
    translationId: number;
    languageCode: string;
    onNavigate: (paragraphIndex: number, matchIndex: number) => void;
}) {
    return (
        <DocumentViewer
            onItemClick={() => onNavigate(snippet.paragraphIndex, snippet.matchIndex)}
            name={hitTitle}
            sermonId={sermonId}
            translationId={translationId}
            languageCode={languageCode}
        >
            <div className="search-snippet-row">
                <span className="snippet-paragraph-badge">{snippet.paragraphIndex}</span>
                <HighlightedText
                    text={snippet.snippet}
                    query={query}
                    mode={searchMode}
                    className="search-highlight-mark"
                    highlights={snippet.highlights}
                    maxChars={350}
                />
            </div>
        </DocumentViewer>
    );
}

export default function SearchResultItem({ hit, query }: { hit: TantivySearchHit; query: string }) {
    const { t } = useTranslation();
    const setDocumentViewQuery = useSearchStore((s) => s.setDocumentViewQuery);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const setCurrentParagraphIndex = useSearchStore((s) => s.setCurrentParagraphIndex);
    const requestScrollToMatch = useSearchStore((s) => s.requestScrollToMatch);
    const { resolveTitle } = useDocumentPresentation();
    const [expanded, setExpanded] = useState(false);

    const searchMode = useSearchStore((s) => s.searchMode);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const contentLanguage = useAppStore((s) => s.contentLanguage) ?? '';
    const documentIdentity = buildSermonDocumentIdentity(
        hit.sermonId,
        hit.translationId,
        contentLanguage,
    );
    const displayTitle = resolveTitle(hit.title, documentIdentity);

    const navigateTo = useCallback(
        (paragraphIndex: number, matchIndex: number) => {
            const tabKey = getTabKey({
                type: 'sermon',
                documentId: hit.sermonId,
                translationId: hit.translationId,
                languageCode: contentLanguage,
            });
            setDocumentViewQuery(tabKey, {
                documentKey: tabKey,
                documentTitle: displayTitle,
                textContentLength: 0,
                matches: [],
                matchedParagraphs: hit.snippets.map((snippet) => ({
                    paragraphIndex: snippet.paragraphIndex,
                    highlights: snippet.highlights,
                })),
                term: query,
                mode: searchMode,
            });
            openSearchBar(tabKey, true);
            setCurrentMatchIndex(tabKey, matchIndex);
            setCurrentParagraphIndex(tabKey, paragraphIndex);
            requestScrollToMatch(tabKey, matchIndex, paragraphIndex);
        },
        [
            displayTitle,
            hit,
            openSearchBar,
            requestScrollToMatch,
            setCurrentMatchIndex,
            setCurrentParagraphIndex,
            setDocumentViewQuery,
            query,
            searchMode,
            contentLanguage,
        ],
    );

    const handleTitleClick = useCallback(() => {
        const targetSnippet = hit.snippets.find(
            (snippet) => snippet.paragraphIndex === hit.paragraphIndex,
        );
        navigateTo(hit.paragraphIndex, targetSnippet?.matchIndex ?? 0);
    }, [navigateTo, hit.paragraphIndex, hit.snippets]);

    const snippets = hit.snippets ?? [];
    const visibleSnippets = expanded ? snippets : snippets.slice(0, INITIAL_SNIPPETS);
    const hasMore = snippets.length > INITIAL_SNIPPETS;

    return (
        <List.Item>
            <div className="w-100">
                <div className="search-result-header">
                    <a className="underline">
                        <DocumentViewer
                            onItemClick={handleTitleClick}
                            name={displayTitle}
                            sermonId={hit.sermonId}
                            translationId={hit.translationId}
                            languageCode={contentLanguage}
                        >
                            {displayTitle}
                        </DocumentViewer>
                    </a>
                    {hit.hitCount > 0 && (
                        <Text type="secondary" className="search-result-hit-count">
                            {hit.hitCount > 1
                                ? t('{{count}} correspondances', { count: hit.hitCount })
                                : t('{{count}} correspondance', { count: hit.hitCount })}
                        </Text>
                    )}
                </div>
                <div className="search-result-snippets">
                    {visibleSnippets.map((s) => (
                        <SnippetRow
                            key={s.paragraphIndex}
                            snippet={s}
                            query={query}
                            searchMode={searchMode}
                            hitTitle={displayTitle}
                            sermonId={hit.sermonId}
                            translationId={hit.translationId}
                            languageCode={contentLanguage}
                            onNavigate={navigateTo}
                        />
                    ))}
                    {hasMore && (
                        <a
                            className="search-result-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(!expanded);
                            }}
                        >
                            {expanded
                                ? t('Voir moins')
                                : t('Voir tout ({{count}})', { count: snippets.length })}
                        </a>
                    )}
                </div>
            </div>
        </List.Item>
    );
}
