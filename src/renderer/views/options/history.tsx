import { useCallback, useEffect, useState } from 'react';
import { Empty, Collapse, List } from 'antd';
import { useTranslation } from 'react-i18next';
import type { DocumentType, HistoryData, HistoryDataItem } from '@shared/types';
import { HistoryOutlined, BookOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument, useOpenCustomDocument, useOpenBibleChapter } from '@renderer/hooks';
import { HISTORY_EVENT } from '@renderer/utils/events';

function useHistoryItemOpen() {
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();

    return useCallback(
        (item: HistoryDataItem) => {
            const docType: DocumentType = item.documentType ?? 'sermon';

            if (docType === 'custom') {
                openCustomDocument(item.documentTitle, item.sermonId);
                return;
            }

            if (docType === 'bible') {
                // sermonId format: "bookCode:chapter", title: "bookName chapter"
                const [bookCode, chapter] = item.sermonId.split(':');
                const bookName = item.documentTitle.replace(new RegExp(`\\s+${chapter}$`), '');
                openBibleChapter(bookName, bookCode, chapter);
                return;
            }

            openDocument(item.documentTitle, item.sermonId);
        },
        [openDocument, openCustomDocument, openBibleChapter],
    );
}

function getHistoryIcon(docType: DocumentType) {
    if (docType === 'bible') return <BookOutlined />;
    if (docType === 'custom') return <FileTextOutlined />;
    return <HistoryOutlined />;
}

export default function History() {
    const { t } = useTranslation();
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [histories, setHistories] = useState<HistoryData[]>([]);
    const [key, setKey] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);
    const openHistoryItem = useHistoryItemOpen();

    const onChange = (key: string | string[]) => {
        const activeKey = Array.isArray(key) ? (key[0] ?? null) : key;
        setKey(activeKey);
    };

    const loadHistories = useCallback(() => {
        if (activeLanguage) {
            window.api.app.getHistory(activeLanguage).then((data) => {
                setHistories(data);
                if (data.length > 0) {
                    setKey((prev) => prev ?? data[0].id);
                }
            });
        }
    }, [activeLanguage]);

    useEffect(() => {
        if (key) {
            const history = histories.find((k) => k.id === key);
            if (history) {
                window.api.app.getHistoryItems(history.id).then(setHistoryItems);
            }
        }
    }, [key, histories]);

    // Load histories on language change (initial load)
    useEffect(() => {
        loadHistories();
    }, [loadHistories]);

    // Refresh when new history entries are added
    useEffect(() => {
        const handler = () => loadHistories();
        window.addEventListener(HISTORY_EVENT.historyUpdated, handler);
        return () => window.removeEventListener(HISTORY_EVENT.historyUpdated, handler);
    }, [loadHistories]);

    return (
        <>
            {histories.length === 0 && <Empty description={t('Aucune historique')} />}
            <Collapse
                activeKey={key || undefined}
                accordion
                onChange={onChange}
                style={{ margin: '20px 0' }}
                items={histories.map((h) => ({
                    key: h.id,
                    label: h.date,
                    children:
                        key === h.id ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={historyItems}
                                renderItem={(item) => (
                                    <List.Item key={item.id}>
                                        <List.Item.Meta
                                            avatar={getHistoryIcon(item.documentType)}
                                            title={
                                                <a onClick={() => openHistoryItem(item)}>
                                                    {item.documentTitle}
                                                </a>
                                            }
                                            description={`${item.date} - ${item.time}`}
                                        />
                                    </List.Item>
                                )}
                            />
                        ) : null,
                }))}
            />
        </>
    );
}
