import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, DatePicker, Empty, Tag, Timeline, Tooltip, Typography } from 'antd';
import type { DatePickerProps } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    HistoryOutlined,
    BookOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { type DocumentType, type HistoryData, type HistoryDataItem } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { useDocumentPresentation, useOpenDocumentRequest } from '@renderer/hooks';
import { HISTORY_EVENT } from '@renderer/utils/events';

const { Text } = Typography;
type PickerDate = Parameters<NonNullable<DatePickerProps['disabledDate']>>[0];

function titleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Open history item by document type
// ---------------------------------------------------------------------------

function useHistoryItemOpen() {
    const { buildOpenRequest } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();

    return useCallback(
        (item: HistoryDataItem) => {
            openDocumentRequest(buildOpenRequest(item.documentTitle, item.documentIdentity));
        },
        [buildOpenRequest, openDocumentRequest],
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
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const selectedHistoryIdRef = useRef<string | null>(null);
    const openHistoryItem = useHistoryItemOpen();
    const { resolveTitle } = useDocumentPresentation();
    const getItemTitle = useCallback(
        (item: HistoryDataItem) => resolveTitle(item.documentTitle, item.documentIdentity),
        [resolveTitle],
    );
    const availableHistoryByDay = useMemo(() => {
        return new Map(histories.map((history) => [history.milliseconds, history]));
    }, [histories]);
    const availableHistoryDays = useMemo(() => {
        return new Set(histories.map((history) => history.milliseconds));
    }, [histories]);

    const loadHistories = useCallback(() => {
        let cancelled = false;

        if (!contentLanguage) {
            setHistories([]);
            setSelectedIndex(0);
            return () => {
                cancelled = true;
            };
        }

        window.api.app.getHistory(contentLanguage).then((data) => {
            if (cancelled) {
                return;
            }

            setHistories(data);
            setSelectedIndex(() => {
                if (!selectedHistoryIdRef.current) {
                    return 0;
                }

                const nextIndex = data.findIndex(
                    (item) => item.id === selectedHistoryIdRef.current,
                );
                return nextIndex >= 0 ? nextIndex : 0;
            });
        });

        return () => {
            cancelled = true;
        };
    }, [contentLanguage]);

    // Load on mount / language change
    useEffect(() => {
        return loadHistories();
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
        selectedHistoryIdRef.current = selectedHistory?.id ?? null;
    }, [selectedHistory]);
    useEffect(() => {
        let cancelled = false;

        if (selectedHistory) {
            window.api.app.getHistoryItems(selectedHistory.id).then((items) => {
                if (!cancelled) {
                    setHistoryItems(items);
                }
            });
        } else {
            setHistoryItems([]);
        }

        return () => {
            cancelled = true;
        };
    }, [selectedHistory]);

    const canGoPrev = selectedIndex < histories.length - 1;
    const canGoNext = selectedIndex > 0;
    const selectedDate = titleCase(selectedHistory?.date ?? '');

    const isToday = useMemo(() => {
        if (!selectedHistory) return false;
        const todayMs = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate(),
        ).getTime();
        return selectedHistory.milliseconds === todayMs;
    }, [selectedHistory]);
    const disableUnavailableDate = useCallback(
        (current: PickerDate) => {
            if (!current) return true;
            return !availableHistoryDays.has(current.startOf('day').valueOf());
        },
        [availableHistoryDays],
    );
    const handleDateChange: NonNullable<DatePickerProps['onChange']> = useCallback(
        (date) => {
            if (!date || Array.isArray(date)) return;

            const history = availableHistoryByDay.get(date.startOf('day').valueOf());
            if (!history) return;

            const nextIndex = histories.findIndex((item) => item.id === history.id);
            if (nextIndex >= 0) {
                setSelectedIndex(nextIndex);
                setDatePickerOpen(false);
            }
        },
        [availableHistoryByDay, histories],
    );

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
                        className="history-date-nav__button"
                        type="text"
                        icon={<LeftOutlined />}
                        disabled={!canGoPrev}
                        onClick={() => setSelectedIndex((i) => i + 1)}
                    />
                    <div className="history-date-label">
                        <Text strong className="history-date-label__primary">
                            {isToday ? t("Aujourd'hui") : selectedDate}
                        </Text>
                        {isToday && <Text type="secondary">{selectedDate}</Text>}
                    </div>
                    <Button
                        className="history-date-nav__button"
                        type="text"
                        icon={<RightOutlined />}
                        disabled={!canGoNext}
                        onClick={() => setSelectedIndex((i) => i - 1)}
                    />
                    <span className="history-date-picker-anchor">
                        <DatePicker
                            allowClear={false}
                            className="history-date-picker"
                            disabledDate={disableUnavailableDate}
                            inputReadOnly
                            onChange={handleDateChange}
                            onOpenChange={setDatePickerOpen}
                            open={datePickerOpen}
                            classNames={{ popup: { root: 'history-date-picker-popup' } }}
                            value={null}
                        />
                        <Tooltip title={t('Choisir une date')}>
                            <Button
                                aria-label={t('Choisir une date')}
                                className="history-date-nav__button history-calendar-button"
                                icon={<CalendarOutlined />}
                                onClick={() => setDatePickerOpen((open) => !open)}
                                type="text"
                            />
                        </Tooltip>
                    </span>
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
