import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Divider, Empty, Progress, Select, Space, Typography, message } from 'antd';
import { CloudDownloadOutlined, LeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { buildBibleDocumentTitle, type BibleIndex, type BibleIndexValue } from '@shared/types';
import { useOpenDocumentRequest } from '@renderer/hooks';
import { useBibleVersions } from '@renderer/hooks/use-bible-versions';
import { useAppStore } from '@renderer/stores';
import ContainerScrollY from '../container-scroll-y';
import { interactiveProps } from '@renderer/utils/interactive';

// ---------------------------------------------------------------------------
// Compact version selector (Select dropdown for sidebar)
// ---------------------------------------------------------------------------

function CompactVersionSelector() {
    const { t } = useTranslation();
    const {
        versions,
        activeVersion,
        installed,
        downloadable,
        downloadProgress,
        handleSwitch,
        handleDownload,
    } = useBibleVersions();
    const [selectedDownloadVersion, setSelectedDownloadVersion] = useState<string>();

    useEffect(() => {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }, [installed, downloadable]);

    useEffect(() => {
        if (downloadable.length === 0) {
            setSelectedDownloadVersion(undefined);
            return;
        }

        setSelectedDownloadVersion((current) => {
            if (current && downloadable.some((version) => version.abbreviation === current)) {
                return current;
            }

            return downloadable[0]?.abbreviation;
        });
    }, [downloadable]);

    if (versions.length === 0) return null;

    const activeDownloads = downloadable
        .filter((version) => downloadProgress[version.abbreviation] != null)
        .map((version) => ({
            ...version,
            progress: downloadProgress[version.abbreviation] ?? 0,
        }));

    const canDownloadSelected =
        selectedDownloadVersion != null && downloadProgress[selectedDownloadVersion] == null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {installed.length > 0 && (
                <Select
                    size="small"
                    className="w-100"
                    value={activeVersion}
                    onChange={handleSwitch}
                    options={installed.map((v) => ({ value: v.abbreviation, label: v.name }))}
                    placeholder={t('Version')}
                />
            )}
            {downloadable.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'rgba(127, 127, 127, 0.08)',
                    }}
                >
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {downloadable.length === 1
                            ? t('1 version disponible au téléchargement')
                            : t('{{count}} versions disponibles au téléchargement', {
                                  count: downloadable.length,
                              })}
                    </Typography.Text>
                    <Space.Compact block>
                        <Select
                            size="small"
                            className="w-100"
                            value={selectedDownloadVersion}
                            onChange={setSelectedDownloadVersion}
                            options={downloadable.map((version) => ({
                                value: version.abbreviation,
                                label: `${version.name} (${version.abbreviation.toUpperCase()})`,
                                disabled: downloadProgress[version.abbreviation] != null,
                            }))}
                            placeholder={t('Choisir une version')}
                            showSearch
                            optionFilterProp="label"
                        />
                        <Button
                            size="small"
                            type="dashed"
                            disabled={!canDownloadSelected}
                            icon={<CloudDownloadOutlined />}
                            onClick={() => {
                                if (selectedDownloadVersion) {
                                    handleDownload(selectedDownloadVersion);
                                }
                            }}
                        >
                            {t('Télécharger')}
                        </Button>
                    </Space.Compact>
                    {activeDownloads.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeDownloads.map((version) => (
                                <div
                                    key={version.abbreviation}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <Typography.Text
                                        ellipsis
                                        style={{ flex: 1, minWidth: 0, fontSize: 12 }}
                                    >
                                        {version.name}
                                    </Typography.Text>
                                    <Progress
                                        percent={version.progress}
                                        size="small"
                                        style={{ width: 84, margin: 0 }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
    const { t } = useTranslation();
    return (
        <div className="sidebar-item" {...interactiveProps(() => onSelect(book))}>
            <div className="sidebar-item__left">
                <div className="sidebar-item__title">{book.bookName}</div>
                <div className="sidebar-item__date">
                    {book.chapters.length}{' '}
                    {book.chapters.length > 1 ? t('chapitres') : t('chapitre')}
                </div>
            </div>
        </div>
    );
});

// ---------------------------------------------------------------------------
// Chapter selection view — shown after picking a book
// ---------------------------------------------------------------------------

function ChapterView({ book, onBack }: { book: BookEntry; onBack: () => void }) {
    const openDocumentRequest = useOpenDocumentRequest();
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const { t } = useTranslation();

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
                    aria-label={t('Retour')}
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
                            onClick={() => {
                                if (activeBibleVersion?.abbreviation) {
                                    openDocumentRequest({
                                        title: buildBibleDocumentTitle(
                                            book.bookName,
                                            ch,
                                            activeBibleVersion.abbreviation,
                                        ),
                                        documentType: 'bible',
                                        bibleBook: book.bookCode,
                                        bibleChapter: ch,
                                        bibleVersionAbbreviation: activeBibleVersion.abbreviation,
                                    });

                                    return;
                                }
                                message.warning(t('Aucune version biblique active disponible.'));
                            }}
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
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const [books, setBooks] = useState<BookEntry[]>([]);
    const [noBible, setNoBible] = useState(false);
    const [selectedBook, setSelectedBook] = useState<BookEntry | null>(null);
    const prevVersionRef = useRef(activeBibleVersion?.abbreviation);

    const loadIndex = useCallback(() => {
        window.api.bible
            .getIndexes(activeBibleVersion?.abbreviation)
            .then((flat: BibleIndex) => {
                if (!flat || Object.keys(flat).length === 0) {
                    setNoBible(true);
                    setBooks([]);
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
                setBooks(entries);
                setNoBible(false);
            })
            .catch(() => {
                setNoBible(true);
            });
    }, [activeBibleVersion?.abbreviation]);

    useEffect(() => {
        const versionChanged = activeBibleVersion?.abbreviation !== prevVersionRef.current;
        prevVersionRef.current = activeBibleVersion?.abbreviation;

        if (versionChanged || books.length === 0) {
            loadIndex();
            setSelectedBook(null);
        }
    }, [loadIndex, contentLanguage, activeBibleVersion]);

    const { t } = useTranslation();

    if (noBible) {
        return (
            <Empty
                description={t('Aucune Bible disponible pour cette langue')}
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
                            label={t('Ancien Testament')}
                            books={oldTestament}
                            onSelect={setSelectedBook}
                        />
                    )}
                    {newTestament.length > 0 && (
                        <BookSection
                            label={t('Nouveau Testament')}
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
                <Typography.Text type="secondary" strong style={{ fontSize: 'var(--fs-rel-lg)' }}>
                    {label}
                </Typography.Text>
            </div>
            {books.map((book) => (
                <BookListItem key={book.bookCode} book={book} onSelect={onSelect} />
            ))}
        </>
    );
}
