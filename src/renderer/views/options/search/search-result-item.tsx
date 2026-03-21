import { useCallback, useState } from 'react';
import { List, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TantivySearchHit, SearchSnippet, SearchMode } from '@shared/types';
import { getTabKey } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import HighlightedText from '@renderer/components/highlighted-text';
import { useSearchStore, useSermonStore, useAppStore } from '@renderer/stores';
import { useSermonLookup } from '@renderer/hooks';

const { Text } = Typography;

const INITIAL_SNIPPETS = 2;

function SnippetRow({
    snippet,
    query,
    searchMode,
    hitTitle,
    sermonId,
    translationId,
    onNavigate,
}: {
    snippet: SearchSnippet;
    query: string;
    searchMode: SearchMode;
    hitTitle: string;
    sermonId: string;
    translationId: number;
    onNavigate: (paragraphIndex: number, matchIndex: number) => void;
}) {
    return (
        <DocumentViewer
            onItemClick={() => onNavigate(snippet.paragraphIndex, snippet.matchIndex)}
            name={hitTitle}
            sermonId={sermonId}
            translationId={translationId}
        >
            <div className="search-snippet-row">
                <span className="snippet-paragraph-badge">{snippet.paragraphIndex}</span>
                <HighlightedText
                    text={snippet.snippet}
                    query={query}
                    mode={searchMode}
                    className="search-highlight-mark"
                    highlights={snippet.highlights}
                />
            </div>
        </DocumentViewer>
    );
}

export default function SearchResultItem({ hit, query }: { hit: TantivySearchHit; query: string }) {
    const { t } = useTranslation();
    const setDocumentViewQuery = useSearchStore((s) => s.setDocumentViewQuery);
    const requestScrollToMatch = useSearchStore((s) => s.requestScrollToMatch);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const { getSermonById } = useSermonLookup();
    const [expanded, setExpanded] = useState(false);

    const searchMode = useSearchStore((s) => s.searchMode);
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    const openSearchBar = useSearchStore((s) => s.openSearchBar);

    const navigateTo = useCallback(
        (paragraphIndex: number, matchIndex: number) => {
            const tabKey = getTabKey({ title: hit.title, sermonId: hit.sermonId });
            setDocumentViewQuery(tabKey, {
                documentKey: tabKey,
                documentTitle: hit.title,
                textContentLength: 0,
                matches: [],
                term: query,
                mode: searchMode,
            });
            openSearchBar(tabKey, true);
            requestScrollToMatch(tabKey, matchIndex);
            if (paragraphIndex > 0) {
                setPendingNavigation({
                    documentTitle: hit.title,
                    documentHtmlTree: {
                        paragraphIndex,
                        translationId: hit.translationId,
                        languageCode: contentLanguage ?? '',
                    },
                });
            }
        },
        [
            hit,
            openSearchBar,
            requestScrollToMatch,
            setDocumentViewQuery,
            setPendingNavigation,
            query,
            searchMode,
            contentLanguage,
        ],
    );

    const handleTitleClick = useCallback(() => {
        navigateTo(hit.paragraphIndex, 0);
    }, [navigateTo, hit.paragraphIndex]);

    const displayTitle = getSermonById(hit.sermonId)?.title ?? hit.title;
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
                            name={hit.title}
                            sermonId={hit.sermonId}
                            translationId={hit.translationId}
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
                            hitTitle={hit.title}
                            sermonId={hit.sermonId}
                            translationId={hit.translationId}
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
