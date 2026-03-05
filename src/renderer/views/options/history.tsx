import { useEffect, useState } from 'react';
import { Empty, Collapse } from 'antd';
import type { HistoryData, HistoryDataItem } from '@shared/types';
import { HistoryOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSermonLookup, useActiveTabTitle } from '@renderer/hooks';

export default function History() {
    const title = useActiveTabTitle();
    const [histories, setHistories] = useState<HistoryData[]>([]);
    const [key, setKey] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const { getSermon } = useSermonLookup();

    const onChange = (key: string | string[]) => {
        if (typeof key === 'string') setKey(key);
    };

    useEffect(() => {
        if (key) {
            const history = histories.find((k) => k.id === key);
            if (history) {
                window.api.app.getHistoryItems(history.id).then(setHistoryItems);
            }
        }
    }, [key, histories]);

    useEffect(() => {
        window.api.app.getHistory().then(setHistories);
    }, [title]);

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
                            <div>
                                {historyItems
                                    .filter((i) => getSermon(i.documentTitle))
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '8px 0',
                                                borderBottom: '1px solid #f0f0f0',
                                            }}
                                        >
                                            <HistoryOutlined style={{ color: '#999' }} />
                                            <div>
                                                <div>
                                                    <a>
                                                        <DocumentViewer name={item.documentTitle}>
                                                            {getSermon(item.documentTitle)?.title ??
                                                                item.documentTitle}
                                                        </DocumentViewer>
                                                    </a>
                                                </div>
                                                <div style={{ fontSize: '0.85em', color: '#888' }}>
                                                    {item.date} - {item.time}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : null,
                }))}
            />
        </>
    );
}
