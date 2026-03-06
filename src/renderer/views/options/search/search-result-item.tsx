import { useCallback, useState } from 'react';
import { List, Typography } from 'antd';
import type { TantivySearchHit, SearchSnippet } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSearchStore, useSermonStore } from '@renderer/stores';
import { useSermonLookup } from '@renderer/hooks';

const { Text } = Typography;

const INITIAL_SNIPPETS = 2;

function SnippetRow({
    snippet,
    hitTitle,
    sermonId,
    onNavigate,
}: {
    snippet: SearchSnippet;
    hitTitle: string;
    sermonId: string;
    onNavigate: (paragraphIndex: number) => void;
}) {
    return (
        <DocumentViewer
            onItemClick={() => onNavigate(snippet.paragraphIndex)}
            name={hitTitle}
            sermonId={sermonId}
        >
            <div className="search-snippet-row">
                <span className="snippet-paragraph-badge">&para;{snippet.paragraphIndex}</span>
                <span dangerouslySetInnerHTML={{ __html: snippet.snippet }} />
            </div>
        </DocumentViewer>
    );
}

export default function SearchResultItem({ hit, query }: { hit: TantivySearchHit; query: string }) {
    const setDocumentViewQueries = useSearchStore((s) => s.setDocumentViewQueries);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const { getSermonById } = useSermonLookup();
    const [expanded, setExpanded] = useState(false);

    const navigateTo = useCallback(
        (paragraphIndex: number) => {
            setDocumentViewQueries((docs) => {
                const filtered = docs.filter((d) => d.documentTitle !== hit.title);
                return [
                    ...filtered,
                    {
                        documentTitle: hit.title,
                        textContentLength: 0,
                        matches: [],
                        term: query,
                    },
                ];
            });
            openSearchBar();
            if (paragraphIndex > 0) {
                setPendingNavigation({
                    documentTitle: hit.title,
                    documentHtmlTree: {
                        paragraphIndex,
                        translationId: hit.translationId,
                        languageCode: '',
                    },
                });
            }
        },
        [hit, setDocumentViewQueries, openSearchBar, setPendingNavigation, query],
    );

    const handleTitleClick = useCallback(() => {
        navigateTo(hit.paragraphIndex);
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
                        >
                            {displayTitle}
                        </DocumentViewer>
                    </a>
                    {hit.hitCount > 0 && (
                        <Text type="secondary" className="search-result-hit-count">
                            {hit.hitCount} correspondance{hit.hitCount > 1 ? 's' : ''}
                        </Text>
                    )}
                </div>
                <div className="search-result-snippets">
                    {visibleSnippets.map((s) => (
                        <SnippetRow
                            key={s.paragraphIndex}
                            snippet={s}
                            hitTitle={hit.title}
                            sermonId={hit.sermonId}
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
                            {expanded ? 'Voir moins' : `Voir tout (${snippets.length})`}
                        </a>
                    )}
                </div>
            </div>
        </List.Item>
    );
}
