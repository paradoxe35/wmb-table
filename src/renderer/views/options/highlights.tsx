import { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, Input, Pagination, Popconfirm, Spin, Tag, Typography, message } from 'antd';
import {
    BgColorsOutlined,
    BookOutlined,
    DeleteOutlined,
    FileTextOutlined,
    LoadingOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { DocumentType, HighlightItem, HighlightSearchResult } from '@shared/types';
import { useOpenDocument, useOpenCustomDocument, useOpenBibleChapter } from '@renderer/hooks';
import { HIGHLIGHT_EVENT } from '@renderer/utils/events';

const { Text } = Typography;

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HighlightGroup {
    groupId: string;
    documentTitle: string;
    sermonId: string;
    textSnippet: string;
    color: string;
    comment?: string;
    documentType: DocumentType;
    translationId: number;
    languageCode: string;
    createdAt: Date;
    ids: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupHighlights(items: HighlightItem[]): HighlightGroup[] {
    const map = new Map<string, HighlightGroup>();

    for (const item of items) {
        const existing = map.get(item.groupId);
        if (existing) {
            existing.ids.push(item.id);
        } else {
            map.set(item.groupId, {
                groupId: item.groupId,
                documentTitle: item.documentTitle,
                sermonId: item.sermonId,
                textSnippet: item.textSnippet,
                color: item.color,
                comment: item.comment,
                documentType: item.documentType,
                translationId: item.translationId,
                languageCode: item.languageCode,
                createdAt: item.createdAt,
                ids: [item.id],
            });
        }
    }

    return [...map.values()];
}

const DOC_TYPE_META: Record<DocumentType, { icon: React.ReactNode; color: string; label: string }> =
    {
        sermon: { icon: <SoundOutlined />, color: 'blue', label: 'Prédication' },
        bible: { icon: <BookOutlined />, color: 'green', label: 'Bible' },
        custom: { icon: <FileTextOutlined />, color: 'orange', label: 'Document' },
    };

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useHighlightOpen() {
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();

    return useCallback(
        (item: HighlightGroup) => {
            if (item.documentType === 'custom') {
                openCustomDocument(item.documentTitle, item.sermonId);
                return;
            }
            if (item.documentType === 'bible') {
                const [bookCode, chapter] = item.sermonId.split(':');
                const bookName = item.documentTitle.replace(new RegExp(`\\s+${chapter}$`), '');
                openBibleChapter(bookName, bookCode, chapter);
                return;
            }
            openDocument(item.documentTitle, item.sermonId, item.translationId);
        },
        [openDocument, openCustomDocument, openBibleChapter],
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorDot({ color }: { color: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: color,
                border: '1px solid var(--ant-color-border)',
                flexShrink: 0,
            }}
        />
    );
}

function DocumentTypeTag({ documentType }: { documentType: DocumentType }) {
    const { t } = useTranslation();
    const meta = DOC_TYPE_META[documentType] ?? DOC_TYPE_META.sermon;

    return (
        <Tag
            color={meta.color}
            bordered={false}
            icon={meta.icon}
            style={{ fontSize: '0.75em', marginInlineEnd: 0 }}
        >
            {t(meta.label)}
        </Tag>
    );
}

function HighlightListItem({
    group,
    onOpen,
    onDelete,
}: {
    group: HighlightGroup;
    onOpen: (g: HighlightGroup) => void;
    onDelete: (g: HighlightGroup) => void;
}) {
    const { t } = useTranslation();
    const snippet =
        group.textSnippet.length > 80 ? group.textSnippet.slice(0, 80) + '...' : group.textSnippet;

    return (
        <div
            onClick={() => onOpen(group)}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--ant-color-split)',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--ant-color-fill-quaternary)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
            <ColorDot color={group.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text
                        ellipsis
                        style={{ fontSize: '0.85em', fontWeight: 500, flex: 1, lineHeight: 1.3 }}
                    >
                        {group.documentTitle}
                    </Text>
                    <DocumentTypeTag documentType={group.documentType} />
                </div>
                <Text type="secondary" style={{ fontSize: '0.8em', lineHeight: 1.3 }}>
                    {snippet}
                </Text>
                {group.comment && (
                    <Text
                        type="secondary"
                        italic
                        style={{ fontSize: '0.75em', display: 'block', marginTop: 1 }}
                    >
                        {group.comment}
                    </Text>
                )}
            </div>
            <Popconfirm
                title={t('Supprimer ce soulignage ?')}
                onConfirm={(e) => {
                    e?.stopPropagation();
                    onDelete(group);
                }}
                onCancel={(e) => e?.stopPropagation()}
                okText={t('Supprimer')}
                cancelText={t('Annuler')}
            >
                <DeleteOutlined
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        color: 'var(--ant-color-text-quaternary)',
                        fontSize: 12,
                        marginTop: 3,
                        flexShrink: 0,
                    }}
                />
            </Popconfirm>
        </div>
    );
}

function HighlightsHeader({ total }: { total: number }) {
    const { t } = useTranslation();

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BgColorsOutlined style={{ fontSize: 18 }} />
            <Text strong style={{ fontSize: '1.05em' }}>
                {t('Soulignages')}
            </Text>
            {total > 0 && (
                <Text type="secondary" style={{ fontSize: '0.85em' }}>
                    ({total})
                </Text>
            )}
        </div>
    );
}

function EmptyState({ query }: { query: string }) {
    const { t } = useTranslation();

    return (
        <div style={{ marginTop: '2rem' }}>
            <Empty
                image={
                    <BgColorsOutlined
                        style={{ fontSize: 48, color: 'var(--ant-color-text-quaternary)' }}
                    />
                }
                description={
                    query ? t('Aucun résultat pour "{{query}}"', { query }) : t('Aucun soulignage')
                }
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Highlights() {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<HighlightGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const openHighlight = useHighlightOpen();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const fetchPage = useCallback(async (searchQuery: string, pageNum: number) => {
        setLoading(true);
        try {
            const result: HighlightSearchResult = await window.api.highlights.search(
                searchQuery,
                pageNum,
                PAGE_SIZE,
            );
            setGroups(groupHighlights(result.items));
            setTotal(result.total);
            setPage(pageNum);
        } catch {
            message.error(t('Erreur lors du chargement des soulignages'));
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchPage('', 0);
    }, [fetchPage]);

    // Refresh on highlight changes
    useEffect(() => {
        const refresh = () => fetchPage(query, 0);
        window.addEventListener(HIGHLIGHT_EVENT.highlightsUpdated, refresh);
        return () => window.removeEventListener(HIGHLIGHT_EVENT.highlightsUpdated, refresh);
    }, [fetchPage, query]);

    const handleSearch = useCallback(
        (value: string) => {
            setQuery(value);
            fetchPage(value, 0);
        },
        [fetchPage],
    );

    const handleInputChange = useCallback(
        (value: string) => {
            clearTimeout(debounceRef.current);
            if (!value) {
                setQuery('');
                fetchPage('', 0);
                return;
            }
            debounceRef.current = setTimeout(() => {
                setQuery(value);
                fetchPage(value, 0);
            }, 300);
        },
        [fetchPage],
    );

    const handlePageChange = useCallback(
        (antPage: number) => {
            fetchPage(query, antPage - 1);
        },
        [fetchPage, query],
    );

    const handleDelete = useCallback(async (group: HighlightGroup) => {
        try {
            await window.api.highlights.delete(group.ids[0]);
            window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            message.success(t('Soulignage supprimé'));
        } catch {
            message.error(t('Erreur lors de la suppression'));
        }
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
                <HighlightsHeader total={total} />
                <Input.Search
                    placeholder={t('Rechercher...')}
                    allowClear
                    onSearch={handleSearch}
                    onChange={(e) => handleInputChange(e.target.value)}
                />
            </div>

            <div className="container-y" style={{ flex: 1, minHeight: 0 }}>
                {loading && groups.length === 0 ? (
                    <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                        <Spin indicator={<LoadingOutlined spin />} />
                    </div>
                ) : groups.length === 0 ? (
                    <EmptyState query={query} />
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {groups.map((group) => (
                                <motion.div
                                    key={group.groupId}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -80 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <HighlightListItem
                                        group={group}
                                        onOpen={openHighlight}
                                        onDelete={handleDelete}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {total > PAGE_SIZE && (
                            <div className="flex flex-center" style={{ padding: '8px 0 16px' }}>
                                <Pagination
                                    current={page + 1}
                                    pageSize={PAGE_SIZE}
                                    total={total}
                                    showSizeChanger={false}
                                    onChange={handlePageChange}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
