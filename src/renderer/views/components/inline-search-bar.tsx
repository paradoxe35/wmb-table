import { useCallback, useEffect, useRef } from 'react';
import { Input, Button } from 'antd';
import type { InputRef } from 'antd';
import { UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    useSearchStore,
    selectActiveTabKey,
    selectActiveTabTitle,
    useSermonStore,
} from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';

export default function InlineSearchBar() {
    const { t } = useTranslation();
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const activeTitle = useSermonStore(selectActiveTabTitle);
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
    const totalMatches = searchUi?.totalMatches ?? 0;
    const navOnly = searchUi?.searchBarNavOnly ?? false;
    const existingQuery = useSearchStore((s) =>
        activeTabKey ? s.documentViewQueries[activeTabKey] : null,
    );
    const searchMode = useSearchStore((s) => s.searchMode);

    const inputRef = useRef<InputRef>(null);
    const searchTermRef = useRef('');

    // Keep latest values in refs so the debounced callback never captures stale closures
    const latestRef = useRef({ activeTitle, activeTabKey, searchMode });
    latestRef.current = { activeTitle, activeTabKey, searchMode };

    useEffect(() => {
        if (existingQuery?.term && inputRef.current?.input) {
            inputRef.current.input.value = existingQuery.term;
            searchTermRef.current = existingQuery.term;
        }
        if (!navOnly) inputRef.current?.focus();
    }, [existingQuery, navOnly]);

    // Stable debounced function — never recreated, reads latest values from refs
    const debouncedSearch = useRef(
        debounce((value: string) => {
            const {
                activeTitle: title,
                activeTabKey: tabKey,
                searchMode: mode,
            } = latestRef.current;
            if (!title || !tabKey) return;
            if (value.trim().length < 3) {
                useSearchStore.getState().clearSearch(tabKey);
                return;
            }
            setDocumentViewQuery(tabKey, {
                documentKey: tabKey,
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

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            searchTermRef.current = e.target.value;
            debouncedSearch(e.target.value);
        },
        [debouncedSearch],
    );

    const handleClose = useCallback(() => {
        if (activeTabKey) clearSearch(activeTabKey);
        if (activeTabKey) closeSearchBar(activeTabKey);
    }, [activeTabKey, clearSearch, closeSearchBar]);

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

    const handleParagraphJump = useCallback(() => {
        const val = searchTermRef.current.trim();
        const num = parseInt(val, 10);
        if (isNaN(num)) return;
        const el = document.querySelector(`[data-paragraph-index="${num}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

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
                    fontSize: '0.8em',
                    color: 'var(--ant-color-text-secondary)',
                    minWidth: 50,
                    textAlign: 'center',
                }}
            >
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
            {!navOnly && (
                <Button
                    type="text"
                    size="small"
                    title={t('Aller au paragraphe')}
                    onClick={handleParagraphJump}
                    style={{ fontSize: '0.75em' }}
                >
                    &para;
                </Button>
            )}
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
        </div>
    );
}
