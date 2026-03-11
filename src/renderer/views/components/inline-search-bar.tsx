import { useCallback, useEffect, useRef } from 'react';
import { Input, Button } from 'antd';
import { UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchStore } from '@renderer/stores';
import { selectActiveTabTitle, useSermonStore } from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';

export default function InlineSearchBar() {
    const { t } = useTranslation();
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const setDocumentViewQueries = useSearchStore((s) => s.setDocumentViewQueries);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const clearSearch = useSearchStore((s) => s.clearSearch);
    const nextMatch = useSearchStore((s) => s.nextMatch);
    const prevMatch = useSearchStore((s) => s.prevMatch);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
    const totalMatches = useSearchStore((s) => s.totalMatches);
    const navOnly = useSearchStore((s) => s.searchBarNavOnly);

    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const searchMode = useSearchStore((s) => s.searchMode);

    const inputRef = useRef<any>(null);
    const searchTermRef = useRef('');

    useEffect(() => {
        const existing = documentViewQueries.find((q) => q.documentTitle === activeTitle);
        if (existing?.term && inputRef.current) {
            inputRef.current.input.value = existing.term;
            searchTermRef.current = existing.term;
        }
        if (!navOnly) inputRef.current?.focus();
    }, []);

    const updateSearch = useCallback(
        debounce((value: string) => {
            if (!activeTitle) return;
            if (value.trim().length < 3) {
                clearSearch(activeTitle);
                return;
            }
            setDocumentViewQueries((docs) => {
                const filtered = docs.filter((d) => d.documentTitle !== activeTitle);
                return [
                    ...filtered,
                    {
                        documentTitle: activeTitle,
                        matches: [],
                        textContentLength: 0,
                        searchForParagraph: false,
                        term: value.trim(),
                        mode: searchMode,
                    },
                ];
            });
        }, 300),
        [activeTitle, setDocumentViewQueries, clearSearch, searchMode],
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            searchTermRef.current = e.target.value;
            updateSearch(e.target.value);
        },
        [updateSearch],
    );

    const handleClose = useCallback(() => {
        if (activeTitle) clearSearch(activeTitle);
        closeSearchBar();
    }, [activeTitle, clearSearch, closeSearchBar]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Enter') {
                if (e.shiftKey) {
                    prevMatch();
                } else {
                    nextMatch();
                }
            }
        },
        [handleClose, nextMatch, prevMatch],
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
                onClick={prevMatch}
                disabled={totalMatches === 0}
            />
            <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                onClick={nextMatch}
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
