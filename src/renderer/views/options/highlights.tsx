import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Button,
    Empty,
    Input,
    Pagination,
    Popconfirm,
    Spin,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    BgColorsOutlined,
    DeleteOutlined,
    FilePdfOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { buildParagraphReference } from '@shared/types';
import type {
    ParagraphReference,
    DocumentType,
    HighlightItem,
    HighlightSearchResult,
} from '@shared/types';
import {
    buildPendingNavigation,
    useDocumentPresentation,
    useOpenDocumentRequest,
} from '@renderer/hooks';
import { useAppStore, useDocumentTabsStore } from '@renderer/stores';
import { HIGHLIGHT_EVENT } from '@renderer/utils/events';

const { Text } = Typography;

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HighlightGroup {
    groupId: string;
    documentTitle: string;
    reference: ParagraphReference;
    color: string;
    comment?: string;
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
                reference:
                    item.documentIdentity.documentType === 'sermon'
                        ? buildParagraphReference(
                              item.documentIdentity,
                              item.paragraphIndex,
                              item.textSnippet,
                          )
                        : buildParagraphReference(
                              item.documentIdentity,
                              item.paragraphIndex,
                              item.languageCode,
                              item.textSnippet,
                          ),
                color: item.color,
                comment: item.comment,
                createdAt: item.createdAt,
                ids: [item.id],
            });
        }
    }

    return [...map.values()];
}

const DOC_TYPE_META: Record<DocumentType, { color: string; label: string }> = {
    sermon: { color: 'blue', label: 'Prédication' },
    bible: { color: 'green', label: 'Bible' },
    custom: { color: 'orange', label: 'Document' },
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useHighlightOpen() {
    const openDocumentRequest = useOpenDocumentRequest();
    const { buildOpenRequest } = useDocumentPresentation();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);

    return useCallback(
        (item: HighlightGroup) => {
            const reference = item.reference;
            const request = buildOpenRequest(item.documentTitle, reference);
            setPendingNavigation(buildPendingNavigation(request, reference));
            openDocumentRequest(request);
        },
        [buildOpenRequest, openDocumentRequest, setPendingNavigation],
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
            style={{ fontSize: 'var(--fs-rel-md)', marginInlineEnd: 0 }}
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
    const { resolveTitle } = useDocumentPresentation();

    let snippet = group.reference.textSnippet ?? '';
    if (snippet.length > 80) {
        snippet = snippet.slice(0, 80) + '...';
    }

    const displayTitle = resolveTitle(group.documentTitle, group.reference.documentIdentity);

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
                        style={{
                            fontSize: 'var(--fs-rel-xl)',
                            fontWeight: 500,
                            flex: 1,
                            lineHeight: 1.3,
                        }}
                    >
                        {displayTitle}
                    </Text>
                    <DocumentTypeTag documentType={group.reference.documentIdentity.documentType} />
                </div>
                <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)', lineHeight: 1.3 }}>
                    {snippet}
                </Text>
                {group.comment && (
                    <Text
                        type="secondary"
                        italic
                        style={{ fontSize: 'var(--fs-rel-md)', display: 'block', marginTop: 1 }}
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
                        fontSize: 'var(--fs-sm)',
                        marginTop: 3,
                        flexShrink: 0,
                    }}
                />
            </Popconfirm>
        </div>
    );
}

function HighlightsHeader({ total, onExportPdf }: { total: number; onExportPdf: () => void }) {
    const { t } = useTranslation();

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BgColorsOutlined style={{ fontSize: 'var(--fs-2xl)' }} />
            <Text strong style={{ fontSize: 'var(--fs-base)' }}>
                {t('Soulignages')}
            </Text>
            {total > 0 && (
                <>
                    <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                        ({total})
                    </Text>
                    <Tooltip title={t('Exporter en PDF')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={onExportPdf}
                            aria-label={t('Exporter en PDF')}
                        />
                    </Tooltip>
                </>
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
                        style={{
                            fontSize: 'var(--fs-11xl)',
                            color: 'var(--ant-color-text-quaternary)',
                        }}
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
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    const fetchPage = useCallback(
        async (searchQuery: string, pageNum: number) => {
            setLoading(true);
            try {
                const langCode = contentLanguage?.split('-')[0].toLowerCase();
                const result: HighlightSearchResult = await window.api.highlights.search(
                    searchQuery,
                    pageNum,
                    PAGE_SIZE,
                    langCode,
                );
                setGroups(groupHighlights(result.items));
                setTotal(result.total);
                setPage(pageNum);
            } catch {
                message.error(t('Erreur lors du chargement des soulignages'));
            } finally {
                setLoading(false);
            }
        },
        [contentLanguage],
    );

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

    const handleExportPdf = useCallback(async () => {
        try {
            const langCode = contentLanguage?.split('-')[0].toLowerCase();
            const filePath = await window.api.highlights.exportPdf(langCode);
            if (filePath) message.success(t('PDF exporté avec succès'));
        } catch {
            message.error(t("Erreur lors de l'export PDF"));
        }
    }, [contentLanguage]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
                <HighlightsHeader total={total} onExportPdf={handleExportPdf} />
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
