import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Tag, Timeline, Typography } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    HistoryOutlined,
    BookOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    getDisplayDocumentTitle,
    type DocumentType,
    type HistoryData,
    type HistoryDataItem,
} from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument, useOpenCustomDocument, useOpenBibleChapter } from '@renderer/hooks';
import { HISTORY_EVENT } from '@renderer/utils/events';

const { Text } = Typography;

function titleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Open history item by document type
// ---------------------------------------------------------------------------

function useHistoryItemOpen() {
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();

    return useCallback(
        (item: HistoryDataItem) => {
            const documentIdentity = item.documentIdentity;

            if (documentIdentity.documentType === 'custom') {
                openCustomDocument(item.documentTitle, documentIdentity.customDocumentId);
                return;
            }

            if (documentIdentity.documentType === 'bible') {
                openBibleChapter({
                    title: getDisplayDocumentTitle(item.documentTitle, documentIdentity),
                    ...documentIdentity,
                });
                return;
            }

            openDocument(
                item.documentTitle,
                documentIdentity.sermonId,
                documentIdentity.translationId,
            );
        },
        [openDocument, openCustomDocument, openBibleChapter],
    );
}

// ---------------------------------------------------------------------------
// Document type metadata
// ---------------------------------------------------------------------------

const DOC_TYPE_META: Record<DocumentType, { icon: React.ReactNode; color: string; label: string }> =
    {
        sermon: { icon: <HistoryOutlined />, color: 'blue', label: 'Prédication' },
        bible: { icon: <BookOutlined />, color: 'green', label: 'Bible' },
        custom: { icon: <FileTextOutlined />, color: 'orange', label: 'Document' },
    };

// ---------------------------------------------------------------------------
// History component
// ---------------------------------------------------------------------------

export default function History() {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [histories, setHistories] = useState<HistoryData[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);
    const openHistoryItem = useHistoryItemOpen();
    const getItemTitle = useCallback(
        (item: HistoryDataItem) =>
            getDisplayDocumentTitle(item.documentTitle, item.documentIdentity),
        [],
    );

    const loadHistories = useCallback(() => {
        if (contentLanguage) {
            window.api.app.getHistory(contentLanguage).then((data) => {
                setHistories(data);
                setSelectedIndex(0);
            });
        }
    }, [contentLanguage]);

    // Load on mount / language change
    useEffect(() => {
        loadHistories();
    }, [loadHistories]);

    // Refresh when new history entries are added
    useEffect(() => {
        const handler = () => loadHistories();
        window.addEventListener(HISTORY_EVENT.historyUpdated, handler);
        return () => window.removeEventListener(HISTORY_EVENT.historyUpdated, handler);
    }, [loadHistories]);

    // Load items when selected day changes
    const selectedHistory = histories[selectedIndex] ?? null;
    useEffect(() => {
        if (selectedHistory) {
            window.api.app.getHistoryItems(selectedHistory.id).then(setHistoryItems);
        } else {
            setHistoryItems([]);
        }
    }, [selectedHistory]);

    const canGoPrev = selectedIndex < histories.length - 1;
    const canGoNext = selectedIndex > 0;

    const isToday = useMemo(() => {
        if (!selectedHistory) return false;
        const todayMs = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate(),
        ).getTime();
        return selectedHistory.milliseconds === todayMs;
    }, [selectedHistory]);

    if (histories.length === 0) {
        return (
            <div className="history-empty">
                <Empty
                    image={
                        <ClockCircleOutlined style={{ fontSize: 'var(--fs-11xl)', opacity: 0.2 }} />
                    }
                    description={t('Aucune historique')}
                />
            </div>
        );
    }

    return (
        <div className="history-view">
            <Card className="history-card">
                {/* Date navigator */}
                <div className="history-date-nav">
                    <Button
                        type="text"
                        size="small"
                        icon={<LeftOutlined />}
                        disabled={!canGoPrev}
                        onClick={() => setSelectedIndex((i) => i + 1)}
                    />
                    <div className="history-date-label">
                        <Text strong>
                            {isToday ? t("Aujourd'hui") : titleCase(selectedHistory?.date ?? '')}
                        </Text>
                        {isToday && (
                            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                                {titleCase(selectedHistory?.date ?? '')}
                            </Text>
                        )}
                    </div>
                    <Button
                        type="text"
                        size="small"
                        icon={<RightOutlined />}
                        disabled={!canGoNext}
                        onClick={() => setSelectedIndex((i) => i - 1)}
                    />
                </div>

                {/* Timeline items */}
                {historyItems.length === 0 ? (
                    <div className="history-empty-day">
                        <Text type="secondary">{t('Aucun document consulté ce jour')}</Text>
                    </div>
                ) : (
                    <div className="history-timeline">
                        <Timeline
                            items={historyItems.map((item) => {
                                const meta = DOC_TYPE_META[item.documentIdentity.documentType];
                                return {
                                    key: item.id,
                                    dot: meta.icon,
                                    children: (
                                        <div
                                            className="history-item"
                                            onClick={() => openHistoryItem(item)}
                                        >
                                            <div className="history-item__header">
                                                <Text className="history-item__title">
                                                    {getItemTitle(item)}
                                                </Text>
                                                <Tag
                                                    color={meta.color}
                                                    bordered={false}
                                                    className="history-item__tag"
                                                >
                                                    {t(meta.label)}
                                                </Tag>
                                            </div>
                                            <Text type="secondary" className="history-item__time">
                                                {item.time}
                                            </Text>
                                        </div>
                                    ),
                                };
                            })}
                        />
                    </div>
                )}

                {/* Page indicator */}
                {histories.length > 1 && (
                    <div className="history-page-indicator">
                        <Text type="secondary" style={{ fontSize: 'var(--fs-rel-md)' }}>
                            {selectedIndex + 1} / {histories.length}
                        </Text>
                    </div>
                )}
            </Card>
        </div>
    );
}
