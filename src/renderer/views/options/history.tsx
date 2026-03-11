import { useEffect, useState, useRef } from 'react';
import { Empty, Collapse, List } from 'antd';
import { useTranslation } from 'react-i18next';
import type { HistoryData, HistoryDataItem } from '@shared/types';
import { HistoryOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSermonLookup, useActiveTabTitle } from '@renderer/hooks';
import { useAppStore, useSermonStore, selectActiveTab } from '@renderer/stores';

export default function History() {
    const { t } = useTranslation();
    const title = useActiveTabTitle();
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [histories, setHistories] = useState<HistoryData[]>([]);
    const [key, setKey] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);
    const { getSermonById } = useSermonLookup();
    const activeTab = useSermonStore(selectActiveTab);
    const prevTitle = useRef<string | null>(null);

    const onChange = (key: string | string[]) => {
        const activeKey = Array.isArray(key) ? (key[0] ?? null) : key;
        setKey(activeKey);
    };

    // Record history when active tab changes
    useEffect(() => {
        if (activeLanguage && title && title !== prevTitle.current && activeTab?.sermonId) {
            window.api.app.addHistoryEntry(activeLanguage, title, activeTab.sermonId);
            // Refresh histories to include the new entry
            window.api.app.getHistory(activeLanguage).then((data) => {
                setHistories(data);
            });
        }
        prevTitle.current = title;
    }, [title, activeLanguage, activeTab?.sermonId]);

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
        if (activeLanguage) {
            window.api.app.getHistory(activeLanguage).then((data) => {
                setHistories(data);
                if (data.length > 0) {
                    setKey(data[0].id);
                }
            });
        }
    }, [activeLanguage]);

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
                                dataSource={historyItems.filter((i) => getSermonById(i.sermonId))}
                                renderItem={(item) => (
                                    <List.Item key={item.id}>
                                        <List.Item.Meta
                                            avatar={<HistoryOutlined />}
                                            title={
                                                <a>
                                                    <DocumentViewer
                                                        name={item.documentTitle}
                                                        sermonId={item.sermonId}
                                                    >
                                                        {getSermonById(item.sermonId)?.title ??
                                                            item.documentTitle}
                                                    </DocumentViewer>
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
