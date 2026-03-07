import { useEffect, useState, useRef } from 'react';
import { Empty, Collapse, List } from 'antd';
import type { HistoryData, HistoryDataItem } from '@shared/types';
import { HistoryOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSermonLookup, useActiveTabTitle } from '@renderer/hooks';
import { useAppStore, useSermonStore, selectActiveTab } from '@renderer/stores';

export default function History() {
    const title = useActiveTabTitle();
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [histories, setHistories] = useState<HistoryData[]>([]);
    const [key, setKey] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const { getSermonById } = useSermonLookup();
    const activeTab = useSermonStore(selectActiveTab);
    const prevTitle = useRef<string | null>(null);

    const onChange = (key: string | string[]) => {
        if (typeof key === 'string') setKey(key);
    };

    // Record history when active tab changes
    useEffect(() => {
        if (activeLanguage && title && title !== prevTitle.current && activeTab?.sermonId) {
            window.api.app.addHistoryEntry(activeLanguage, title, activeTab.sermonId);
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

    useEffect(() => {
        if (activeLanguage) {
            window.api.app.getHistory(activeLanguage).then(setHistories);
        }
    }, [title, activeLanguage]);

    useEffect(() => {
        if (histories.length > 0) {
            setKey(histories[0].id);
            setReloadKey((d) => d + 1);
        }
    }, [histories]);

    return (
        <>
            {histories.length === 0 && <Empty description="Aucune historique" />}
            <Collapse
                key={reloadKey}
                defaultActiveKey={key || undefined}
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
