import { useCallback, useEffect, useRef } from 'react';
import { Input, Button } from 'antd';
import type { InputRef } from 'antd';
import { UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    useSearchStore,
    selectActiveTabKey,
    selectActiveTabTitle,
    useDocumentTabsStore,
} from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';

export default function InlineSearchBar() {
    const { t } = useTranslation();
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const activeTitle = useDocumentTabsStore(selectActiveTabTitle);
    const setDocumentViewQuery = useSearchStore((s) => s.setDocumentViewQuery);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const clearSearch = useSearchStore((s) => s.clearSearch);
    const requestScrollToMatch = useSearchStore((s) => s.requestScrollToMatch);
    const nextMatch = useSearchStore((s) => s.nextMatch);
    const prevMatch = useSearchStore((s) => s.prevMatch);
    const searchUi = useSearchStore((s) =>
        activeTabKey ? s.searchUiByTab[activeTabKey] : undefined,
    );
    const currentMatchIndex = searchUi?.currentMatchIndex ?? 0;
    const currentParagraphIndex = searchUi?.currentParagraphIndex ?? null;
    const totalMatches = searchUi?.totalMatches ?? 0;
    const navOnly = searchUi?.searchBarNavOnly ?? false;
    const existingQuery = useSearchStore((s) =>
        activeTabKey ? s.documentViewQueries[activeTabKey] : null,
    );
    const searchMode = useSearchStore((s) => s.searchMode);

    const inputRef = useRef<InputRef>(null);
    const searchTermRef = useRef('');

    // Keep latest values in refs so the debounced callback never captures stale closures
    const latestRef = useRef({ activeTitle, activeTabKey, searchMode, clearSearch });
    latestRef.current = { activeTitle, activeTabKey, searchMode, clearSearch };

    // Stable debounced function — never recreated, reads latest values from refs
    const debouncedSearch = useRef(
        debounce((value: string) => {
            const {
                activeTitle: title,
                activeTabKey: tabKey,
                searchMode: mode,
                clearSearch: clearActiveSearch,
            } = latestRef.current;
            if (!title || !tabKey) return;
            if (value.trim().length < 3) {
                clearActiveSearch(tabKey);
                return;
            }
            setDocumentViewQuery(tabKey, {
                documentTitle: title,
                matches: [],
                textContentLength: 0,
                searchForParagraph: false,
                term: value.trim(),
                mode,
            });
            requestScrollToMatch(tabKey, 0);
        }, 300),
    ).current;

    // Sync input value with the active tab's query (handles tab switches and external query changes)
    useEffect(() => {
        const term = existingQuery?.term ?? '';
        if (inputRef.current?.input) {
            inputRef.current.input.value = term;
        }
        searchTermRef.current = term;
        if (!navOnly) inputRef.current?.focus();
    }, [existingQuery, navOnly, activeTabKey]);

    // Cancel pending debounced search on tab change to prevent cross-tab contamination
    useEffect(() => {
        return () => debouncedSearch.cancel();
    }, [activeTabKey, debouncedSearch]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            searchTermRef.current = value;
            // Clear immediately when input is empty (allowClear X button or manual delete)
            if (value.trim().length < 3) {
                debouncedSearch.cancel();
                if (activeTabKey) clearSearch(activeTabKey);
                return;
            }
            debouncedSearch(value);
        },
        [debouncedSearch, activeTabKey, clearSearch],
    );

    const handleClose = useCallback(() => {
        if (activeTabKey) closeSearchBar(activeTabKey);
    }, [activeTabKey, closeSearchBar]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Enter') {
                if (e.shiftKey) {
                    if (activeTabKey) prevMatch(activeTabKey);
                } else {
                    if (activeTabKey) nextMatch(activeTabKey);
                }
            }
        },
        [activeTabKey, handleClose, nextMatch, prevMatch],
    );

    return (
        <div className="inline-search-bar">
            {!navOnly && (
                <Input
                    ref={inputRef}
                    size="small"
                    placeholder={t('Rechercher...')}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    style={{ width: 220 }}
                    allowClear
                />
            )}
            <span
                style={{
                    fontSize: 'var(--fs-rel-lg)',
                    color: 'var(--ant-color-text-secondary)',
                    minWidth: 140,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                }}
            >
                {currentParagraphIndex != null ? `¶${currentParagraphIndex}` : '¶-'}
                {' · '}
                {totalMatches > 0 ? `${currentMatchIndex + 1} / ${totalMatches}` : '0 / 0'}
            </span>
            <Button
                type="text"
                size="small"
                icon={<UpOutlined />}
                onClick={() => activeTabKey && prevMatch(activeTabKey)}
                disabled={totalMatches === 0}
            />
            <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                onClick={() => activeTabKey && nextMatch(activeTabKey)}
                disabled={totalMatches === 0}
            />
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
        </div>
    );
}
