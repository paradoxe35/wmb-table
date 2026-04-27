import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, Divider, Empty, Progress, Select, Typography, message } from 'antd';
import { CloudDownloadOutlined, LeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    buildBibleDocumentTitle,
    type BibleIndex,
    type BibleIndexValue,
    type BibleVersionInfo,
} from '@shared/types';
import { useOpenDocumentRequest } from '@renderer/hooks';
import { useBibleVersions } from '@renderer/hooks/use-bible-versions';
import { useAppStore } from '@renderer/stores';
import ContainerScrollY from '../container-scroll-y';
import { interactiveProps } from '@renderer/utils/interactive';

// ---------------------------------------------------------------------------
// Compact version selector (Select dropdown for sidebar)
// ---------------------------------------------------------------------------

const wrappingButtonStyle: CSSProperties = {
    width: '100%',
    height: 'auto',
    minHeight: 24,
    whiteSpace: 'normal',
    textAlign: 'left',
    wordBreak: 'break-word',
};

function DownloadVersionButton({
    version,
    progress,
    onDownload,
}: {
    version: BibleVersionInfo;
    progress: number | undefined;
    onDownload: (abbreviation: string) => void;
}) {
    const isDownloading = progress != null;

    return (
        <Button
            size="small"
            type="dashed"
            disabled={isDownloading}
            icon={
                isDownloading ? (
                    <Progress type="circle" size={14} percent={progress} showInfo={false} />
                ) : (
                    <CloudDownloadOutlined />
                )
            }
            onClick={() => onDownload(version.abbreviation)}
            style={wrappingButtonStyle}
        >
            {version.name}
        </Button>
    );
}

function CompactVersionSelector() {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const showOptions = useAppStore((s) => s.showOptions);
    const {
        versions,
        activeVersion,
        installed,
        downloadable,
        downloadProgress,
        handleSwitch,
        handleDownload,
    } = useBibleVersions();
    useEffect(() => {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }, [installed, downloadable]);

    if (versions.length === 0) return null;

    const activeLanguageMatchesContent =
        !!contentLanguage && activeBibleVersion?.langCode === contentLanguage;
    const downloadableForContentLanguage = contentLanguage
        ? downloadable.filter((version) => version.langCode === contentLanguage)
        : downloadable;
    const suggestedDownload = activeLanguageMatchesContent
        ? null
        : (downloadableForContentLanguage[0] ?? downloadable[0]);

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
            {suggestedDownload && (
                <DownloadVersionButton
                    version={suggestedDownload}
                    progress={downloadProgress[suggestedDownload.abbreviation]}
                    onDownload={handleDownload}
                />
            )}
            {!suggestedDownload && activeLanguageMatchesContent && downloadable.length > 0 && (
                <Button
                    size="small"
                    type="dashed"
                    icon={<CloudDownloadOutlined />}
                    onClick={() => showOptions('bible')}
                    style={wrappingButtonStyle}
                >
                    {t("Télécharger d'autres versions")}
                </Button>
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
