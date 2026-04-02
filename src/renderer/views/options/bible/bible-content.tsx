import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Button,
    Collapse,
    Empty,
    List,
    Segmented,
    Space,
    Spin,
    Typography,
    Dropdown,
    message,
} from 'antd';
import { DownOutlined, LoadingOutlined } from '@ant-design/icons';
import type {
    BibleBook,
    BibleIndex,
    BibleIndexValue,
    DocumentReferenceSelection,
} from '@shared/types';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useAppStore } from '@renderer/stores';

// ---------------------------------------------------------------------------
// Bible content (book browsing)
// ---------------------------------------------------------------------------

export function BibleContent({
    onClick,
    verseMetaContent,
    compact,
}: {
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
    compact?: boolean;
}) {
    const { t } = useTranslation();
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const [bibleIndex, setBibleIndex] = useState<Record<string, BibleIndex>>({});
    const [noBible, setNoBible] = useState(false);

    const loadIndex = useCallback(() => {
        window.api.bible
            .getIndexes(activeBibleVersion?.abbreviation)
            .then((flat) => {
                if (!flat || Object.keys(flat).length === 0) {
                    setNoBible(true);
                    return;
                }
                const grouped: Record<string, BibleIndex> = {};
                for (const [bookName, val] of Object.entries(flat)) {
                    const t = val.testament;
                    if (!grouped[t]) grouped[t] = {};
                    grouped[t][bookName] = val;
                }
                setBibleIndex(grouped);
                setNoBible(false);
            })
            .catch(() => {
                setNoBible(true);
            });
    }, []);

    useEffect(() => {
        loadIndex();
    }, [loadIndex, activeBibleVersion]);

    if (noBible) {
        return (
            <Empty
                description={t('Aucune Bible disponible pour cette langue')}
                style={{ marginTop: '2rem' }}
            />
        );
    }

    const testamentKeys = Object.keys(bibleIndex);

    if (!compact && testamentKeys.length > 1) {
        return (
            <TestamentTabs
                bibleIndex={bibleIndex}
                onClick={onClick}
                verseMetaContent={verseMetaContent}
            />
        );
    }

    return (
        <>
            <Space orientation="vertical" style={{ width: '100%' }}>
                {testamentKeys.map((key, i) => (
                    <Space orientation="vertical" style={{ width: '100%' }} key={key}>
                        <Typography.Title
                            type="secondary"
                            level={5}
                            style={compact && i === 0 ? { marginTop: 0 } : undefined}
                        >
                            {key === 'N' ? t('Nouveau') : t('Ancien')} {t('Testament')}
                        </Typography.Title>
                        <BibleTestamentContent
                            key={key}
                            verseMetaContent={verseMetaContent}
                            onClick={onClick}
                            bibleIndex={bibleIndex[key]}
                        />
                    </Space>
                ))}
            </Space>
            <div className="mt-2 mb-2" />
        </>
    );
}

// ---------------------------------------------------------------------------
// Testament tabs (Segmented toggle)
// ---------------------------------------------------------------------------

function TestamentTabs({
    bibleIndex,
    onClick,
    verseMetaContent,
}: {
    bibleIndex: Record<string, BibleIndex>;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const { t } = useTranslation();
    const keys = Object.keys(bibleIndex);
    const [active, setActive] = useState(keys[0]);

    const options = useMemo(
        () =>
            keys.map((key) => ({
                value: key,
                label: key === 'N' ? t('Nouveau Testament') : t('Ancien Testament'),
            })),
        [keys, t],
    );

    return (
        <>
            <Segmented
                block
                options={options}
                value={active}
                onChange={(v) => setActive(v as string)}
                style={{ marginBottom: 12 }}
            />
            <BibleTestamentContent
                key={active}
                verseMetaContent={verseMetaContent}
                onClick={onClick}
                bibleIndex={bibleIndex[active]}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Testament → Books accordion
// ---------------------------------------------------------------------------

function BibleTestamentContent({
    bibleIndex,
    onClick,
    verseMetaContent,
}: {
    bibleIndex: BibleIndex;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const [currentKey, setCurrentKey] = useState<string>();

    const onChangeKey = useCallback((key: string | string[]) => {
        const k = Array.isArray(key) ? key[0] : key;
        setCurrentKey(k);
    }, []);

    useEffect(() => {
        if (currentKey) {
            document
                .getElementById(`book-${currentKey}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentKey]);

    const collapseItems = useMemo(
        () =>
            bibleIndex
                ? Object.keys(bibleIndex).map((key) => {
                      const book = bibleIndex[key];
                      return {
                          key: book.book,
                          id: `book-${book.book}`,
                          label: key,
                          children:
                              currentKey === book.book ? (
                                  <BookContent
                                      verseMetaContent={verseMetaContent}
                                      onClick={onClick}
                                      bookDetail={book}
                                  />
                              ) : null,
                      };
                  })
                : [],
        [bibleIndex, currentKey, onClick, verseMetaContent],
    );

    return <Collapse onChange={onChangeKey} accordion items={collapseItems} />;
}

// ---------------------------------------------------------------------------
// Single book: chapter selector + verse list
// ---------------------------------------------------------------------------

function BookContent({
    bookDetail,
    onClick,
    verseMetaContent,
}: {
    bookDetail: BibleIndexValue;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const [chaptersKey, setChaptersKey] = useState(1);
    const [verses, setVerses] = useState<BibleBook[]>();

    useEffect(() => {
        window.api.bible
            .getBooks({
                book: bookDetail.book,
                chapter: chaptersKey.toString(),
                bibleVersionAbbreviation: activeBibleVersion?.abbreviation,
            })
            .then(setVerses);
    }, [activeBibleVersion?.abbreviation, chaptersKey, bookDetail.book]);

    const sortedVerses = useMemo(
        () => (verses ? verses.slice().sort((a, b) => +a.verse - +b.verse) : []),
        [verses],
    );

    const chapterList = useMemo(() => {
        return bookDetail.chapters
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
            .sort((a, b) => +a - +b);
    }, [bookDetail.chapters]);

    return (
        <Collapse
            activeKey="1"
            accordion
            expandIcon={() => null}
            items={[
                {
                    key: '1',
                    label: (
                        <ChapterButtons
                            chapters={chapterList}
                            activeChapter={chaptersKey}
                            onSelect={setChaptersKey}
                        />
                    ),
                    children: (
                        <VerseList
                            verses={sortedVerses}
                            loading={!verses || verses.length === 0}
                            onClick={onClick}
                            verseMetaContent={verseMetaContent}
                        />
                    ),
                },
            ]}
        />
    );
}

// ---------------------------------------------------------------------------
// Chapter buttons (inside collapse header)
// ---------------------------------------------------------------------------

const ChapterButtons = memo(function ChapterButtons({
    chapters,
    activeChapter,
    onSelect,
}: {
    chapters: string[];
    activeChapter: number;
    onSelect: (ch: number) => void;
}) {
    return (
        <Space wrap={true}>
            {chapters.map((ch) => {
                const key = +ch;
                return (
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(key);
                        }}
                        key={key}
                        type={key === activeChapter ? 'primary' : 'dashed'}
                    >
                        {ch}
                    </Button>
                );
            })}
        </Space>
    );
});

// ---------------------------------------------------------------------------
// Verse list
// ---------------------------------------------------------------------------

const VerseList = memo(function VerseList({
    verses,
    loading,
    onClick,
    verseMetaContent,
}: {
    verses: BibleBook[];
    loading: boolean;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    if (loading) {
        return (
            <div className="flex flex-center">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 'var(--fs-6xl)' }} spin />} />
            </div>
        );
    }

    return (
        <List
            itemLayout="horizontal"
            dataSource={verses}
            renderItem={(item) => (
                <VerseItem item={item} onClick={onClick} verseMetaContent={verseMetaContent} />
            )}
        />
    );
});

// ---------------------------------------------------------------------------
// Single verse row
// ---------------------------------------------------------------------------

const VerseItem = memo(function VerseItem({
    item,
    onClick,
    verseMetaContent,
}: {
    item: BibleBook;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const handleClick = useCallback(() => onClick?.(item.id), [onClick, item.id]);

    const actions = useMemo(
        () =>
            verseMetaContent
                ? [
                      <span key="action" className="verse-action">
                          <AddToSubject verse={item} />
                      </span>,
                  ]
                : undefined,
        [verseMetaContent, item],
    );

    return (
        <List.Item
            className={`verse-item ${onClick ? 'list__clickable' : ''}`}
            onClick={handleClick}
            actions={actions}
        >
            <List.Item.Meta
                avatar={<span>{item.verse}.</span>}
                description={
                    <Typography.Text className="content-description">
                        {item.content}
                    </Typography.Text>
                }
            />
        </List.Item>
    );
});

// ---------------------------------------------------------------------------
// Add to subject dropdown
// ---------------------------------------------------------------------------

const AddToSubject = memo(function AddToSubject({ verse }: { verse: BibleBook }) {
    const { t } = useTranslation();
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const bibleVersionAbbreviation = activeBibleVersion?.abbreviation;
    const handler = useCallback(() => {
        if (!bibleVersionAbbreviation) {
            message.warning(t('Aucune version biblique active disponible.'));
            return;
        }

        window.dispatchEvent(
            new CustomEvent<Partial<DocumentReferenceSelection>>(
                CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject,
                {
                    detail: {
                        documentPreview: {
                            kind: 'bible-verse',
                            bibleVerse: verse,
                        },
                        textContent: verse.content,
                        documentReference: {
                            kind: 'tree',
                            documentIdentity: {
                                documentType: 'bible',
                                bibleBook: verse.book,
                                bibleChapter: verse.chapter,
                                bibleVersionAbbreviation,
                            },
                            tree: [+verse.verse],
                        },
                    },
                },
            ),
        );
    }, [bibleVersionAbbreviation, verse]);

    const menuItems = useMemo(
        () => [{ key: 'add', label: t('Ajouter à un sujet'), onClick: handler }],
        [handler, t],
    );

    return (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow trigger={['click']}>
            <Button>
                <DownOutlined />
            </Button>
        </Dropdown>
    );
});
