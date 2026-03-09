import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Divider, Empty, Progress, Select, Space, Typography } from 'antd';
import { CloudDownloadOutlined, LeftOutlined } from '@ant-design/icons';
import type {
    BibleDownloadProgress,
    BibleDownloadedEvent,
    BibleIndex,
    BibleIndexValue,
    BibleVersionInfo,
} from '@shared/types';
import { useOpenBibleChapter } from '@renderer/hooks';
import { useAppStore } from '@renderer/stores';
import ContainerScrollY from '../container-scroll-y';
import { interactiveProps } from '@renderer/utils/interactive';

// ---------------------------------------------------------------------------
// Module-level cache — survives unmount/remount across tab switches
// ---------------------------------------------------------------------------

let cachedVersions: BibleVersionInfo[] = [];
let cachedActiveVersion: string | undefined;
let cachedBooks: BookEntry[] = [];
let cachedNoBible = false;
let cachedForLanguage: string | null = null;

function invalidateCache() {
    cachedVersions = [];
    cachedActiveVersion = undefined;
    cachedBooks = [];
    cachedNoBible = false;
}

// ---------------------------------------------------------------------------
// Compact version selector (Select dropdown for sidebar)
// ---------------------------------------------------------------------------

function CompactVersionSelector() {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [versions, setVersions] = useState<BibleVersionInfo[]>(cachedVersions);
    const [activeVersion, setActiveVersion] = useState<string | undefined>(cachedActiveVersion);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    const refresh = useCallback(() => {
        Promise.all([window.api.bible.getVersions(), window.api.bible.getActiveVersion()]).then(
            async ([langVersions, active]) => {
                // If no versions for the active language, show all available versions
                const all =
                    langVersions.length > 0
                        ? langVersions
                        : await window.api.bible.getAllVersions();
                cachedVersions = all;
                cachedActiveVersion = active?.abbreviation;
                cachedForLanguage = activeLanguage;
                setVersions(all);
                setActiveVersion(active?.abbreviation);
            },
        );
    }, [activeLanguage]);

    useEffect(() => {
        // Invalidate cache on language change
        if (activeLanguage !== cachedForLanguage) {
            invalidateCache();
            setVersions([]);
            setActiveVersion(undefined);
        }
        // If we already have cached data, skip the blocking refresh
        if (cachedVersions.length > 0) {
            return;
        }
        window.api.bible
            .refreshIndex()
            .then(() => refresh())
            .catch(() => refresh());
    }, [refresh, activeLanguage]);

    useEffect(() => {
        const unsub1 = window.api.on.bibleDownloadProgress((p: BibleDownloadProgress) => {
            setDownloadProgress((prev) => ({ ...prev, [p.abbreviation]: p.percentage }));
        });
        const unsub2 = window.api.on.bibleDownloaded(({ abbreviation }: BibleDownloadedEvent) => {
            setDownloadProgress((prev) => {
                const next = { ...prev };
                delete next[abbreviation];
                return next;
            });
            handleSwitch(abbreviation);
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSwitch = useCallback(
        async (abbreviation: string) => {
            await window.api.bible.switchVersion(abbreviation);
            refresh();
            window.dispatchEvent(new Event('bible-version-changed'));
        },
        [refresh],
    );

    const handleDownload = useCallback((abbreviation: string) => {
        setDownloadProgress((prev) => ({ ...prev, [abbreviation]: 0 }));
        window.api.bible.downloadVersion(abbreviation);
    }, []);

    const { installed, downloadable } = useMemo(() => {
        const inst: BibleVersionInfo[] = [];
        const dl: BibleVersionInfo[] = [];
        for (const v of versions) {
            if (v.available) inst.push(v);
            else dl.push(v);
        }
        return { installed: inst, downloadable: dl };
    }, [versions]);

    // send resize event to help ContainerScrollY to get space available
    useEffect(() => {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }, [installed, downloadable]);

    if (versions.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {installed.length > 0 && (
                <Select
                    size="small"
                    className="w-100"
                    value={activeVersion}
                    onChange={handleSwitch}
                    options={installed.map((v) => ({ value: v.abbreviation, label: v.name }))}
                    placeholder="Version"
                />
            )}
            {downloadable.length > 0 && (
                <Space size="small" wrap>
                    {downloadable.map((v) => {
                        const progress = downloadProgress[v.abbreviation];
                        const isDownloading = progress != null;
                        return (
                            <Button
                                key={v.abbreviation}
                                size="small"
                                type="dashed"
                                disabled={isDownloading}
                                icon={
                                    isDownloading ? (
                                        <Progress
                                            type="circle"
                                            size={14}
                                            percent={progress}
                                            showInfo={false}
                                        />
                                    ) : (
                                        <CloudDownloadOutlined />
                                    )
                                }
                                onClick={() => handleDownload(v.abbreviation)}
                            >
                                {v.name}
                            </Button>
                        );
                    })}
                </Space>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Book list view — flat list of book names (like sermon sidebar items)
// ---------------------------------------------------------------------------

type BookEntry = { bookName: string; bookCode: string; testament: string; chapters: string[] };

const BookListItem = memo(function BookListItem({
    book,
    onSelect,
}: {
    book: BookEntry;
    onSelect: (book: BookEntry) => void;
}) {
    return (
        <div className="sidebar-item" {...interactiveProps(() => onSelect(book))}>
            <div className="sidebar-item__left">
                <div className="sidebar-item__title">{book.bookName}</div>
                <div className="sidebar-item__date">
                    {book.chapters.length} chapitre{book.chapters.length > 1 ? 's' : ''}
                </div>
            </div>
        </div>
    );
});

// ---------------------------------------------------------------------------
// Chapter selection view — shown after picking a book
// ---------------------------------------------------------------------------

function ChapterView({ book, onBack }: { book: BookEntry; onBack: () => void }) {
    const openChapter = useOpenBibleChapter();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                }}
            >
                <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    onClick={onBack}
                    aria-label="Retour"
                />
                <Typography.Text strong ellipsis style={{ flex: 1 }}>
                    {book.bookName}
                </Typography.Text>
            </div>
            <Divider style={{ margin: 0 }} />
            <ContainerScrollY>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
                        gap: 6,
                        padding: '10px 12px',
                    }}
                >
                    {book.chapters.map((ch) => (
                        <Button
                            key={ch}
                            size="small"
                            onClick={() => openChapter(book.bookName, book.bookCode, ch)}
                            style={{ width: '100%' }}
                        >
                            {ch}
                        </Button>
                    ))}
                </div>
            </ContainerScrollY>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main sidebar Bible browser
// ---------------------------------------------------------------------------

export default function SidebarBibleBrowser() {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [books, setBooks] = useState<BookEntry[]>(cachedBooks);
    const [noBible, setNoBible] = useState(cachedNoBible);
    const [selectedBook, setSelectedBook] = useState<BookEntry | null>(null);

    const loadIndex = useCallback(() => {
        window.api.bible
            .getIndexes()
            .then((flat: BibleIndex) => {
                if (!flat || Object.keys(flat).length === 0) {
                    cachedNoBible = true;
                    cachedBooks = [];
                    setNoBible(true);
                    return;
                }
                const entries: BookEntry[] = Object.entries(flat).map(
                    ([bookName, val]: [string, BibleIndexValue]) => ({
                        bookName,
                        bookCode: val.book,
                        testament: val.testament,
                        chapters: val.chapters
                            .split(',')
                            .map((c) => c.trim())
                            .filter(Boolean)
                            .sort((a, b) => +a - +b),
                    }),
                );
                cachedBooks = entries;
                cachedNoBible = false;
                setBooks(entries);
                setNoBible(false);
            })
            .catch(() => {
                cachedNoBible = true;
                setNoBible(true);
            });
    }, []);

    useEffect(() => {
        // Reload when language changes or no cached data
        if (cachedBooks.length === 0 || activeLanguage !== cachedForLanguage) {
            loadIndex();
            setSelectedBook(null);
        }

        const handler = () => {
            loadIndex();
            setSelectedBook(null);
        };
        window.addEventListener('bible-version-changed', handler);
        return () => window.removeEventListener('bible-version-changed', handler);
    }, [loadIndex, activeLanguage]);

    if (noBible) {
        return (
            <Empty
                description="Aucune Bible disponible pour cette langue"
                style={{ marginTop: '2rem' }}
            />
        );
    }

    if (selectedBook) {
        return <ChapterView book={selectedBook} onBack={() => setSelectedBook(null)} />;
    }

    const oldTestament = books.filter((b) => b.testament !== 'N');
    const newTestament = books.filter((b) => b.testament === 'N');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px 4px' }}>
                <CompactVersionSelector />
            </div>
            <Divider style={{ margin: '4px 0 0' }} />
            <div className="document-list" style={{ flex: 1 }}>
                <ContainerScrollY>
                    {oldTestament.length > 0 && (
                        <BookSection
                            label="Ancien Testament"
                            books={oldTestament}
                            onSelect={setSelectedBook}
                        />
                    )}
                    {newTestament.length > 0 && (
                        <BookSection
                            label="Nouveau Testament"
                            books={newTestament}
                            onSelect={setSelectedBook}
                        />
                    )}
                </ContainerScrollY>
            </div>
        </div>
    );
}

function BookSection({
    label,
    books,
    onSelect,
}: {
    label: string;
    books: BookEntry[];
    onSelect: (book: BookEntry) => void;
}) {
    return (
        <>
            <div style={{ padding: '8px 10px 4px' }}>
                <Typography.Text type="secondary" strong style={{ fontSize: '0.8em' }}>
                    {label}
                </Typography.Text>
            </div>
            {books.map((book) => (
                <BookListItem key={book.bookCode} book={book} onSelect={onSelect} />
            ))}
        </>
    );
}
