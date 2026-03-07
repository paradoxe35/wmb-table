import React, { useCallback, useMemo, useState } from 'react';
import { List, Typography } from 'antd';
import type { TantivySearchHit, SearchSnippet } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSearchStore, useSermonStore, useAppStore } from '@renderer/stores';
import { useSermonLookup } from '@renderer/hooks';
import { strNormalizeNoLower, buildHighlightRegex } from '@renderer/utils/searchable';

const { Text } = Typography;

const INITIAL_SNIPPETS = 2;

function HighlightedText({ text, query }: { text: string; query: string }) {
    const searchMode = useSearchStore((s) => s.searchMode);

    const parts = useMemo(() => {
        const regex = buildHighlightRegex(query, searchMode);
        if (!regex) return [text];

        const normalized = strNormalizeNoLower(text);
        const matches = [...normalized.matchAll(regex)];
        if (matches.length === 0) return [text];

        const result: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        matches.forEach((m, i) => {
            const start = m.index!;
            const end = start + m[0].length;
            if (start > lastIndex) {
                result.push(text.slice(lastIndex, start));
            }
            result.push(
                <mark key={i} className="search-highlight-mark">
                    {text.slice(start, end)}
                </mark>,
            );
            lastIndex = end;
        });
        if (lastIndex < text.length) {
            result.push(text.slice(lastIndex));
        }
        return result;
    }, [text, query, searchMode]);

    return <>{parts}</>;
}

function SnippetRow({
    snippet,
    query,
    hitTitle,
    sermonId,
    translationId,
    onNavigate,
}: {
    snippet: SearchSnippet;
    query: string;
    hitTitle: string;
    sermonId: string;
    translationId: number;
    onNavigate: (paragraphIndex: number) => void;
}) {
    return (
        <DocumentViewer
            onItemClick={() => onNavigate(snippet.paragraphIndex)}
            name={hitTitle}
            sermonId={sermonId}
            translationId={translationId}
        >
            <div className="search-snippet-row">
                <span className="snippet-paragraph-badge">{snippet.paragraphIndex}</span>
                <HighlightedText text={snippet.snippet} query={query} />
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

    const searchMode = useSearchStore((s) => s.searchMode);
    const activeLanguage = useAppStore((s) => s.activeLanguage);

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
                        mode: searchMode,
                    },
                ];
            });
            openSearchBar(true);
            if (paragraphIndex > 0) {
                setPendingNavigation({
                    documentTitle: hit.title,
                    documentHtmlTree: {
                        paragraphIndex,
                        translationId: hit.translationId,
                        languageCode: activeLanguage ?? '',
                    },
                });
            }
        },
        [
            hit,
            setDocumentViewQueries,
            openSearchBar,
            setPendingNavigation,
            query,
            searchMode,
            activeLanguage,
        ],
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
                            translationId={hit.translationId}
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
                            query={query}
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
                            {expanded ? 'Voir moins' : `Voir tout (${snippets.length})`}
                        </a>
                    )}
                </div>
            </div>
        </List.Item>
    );
}
