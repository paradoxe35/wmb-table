import { useEffect, useState } from 'react';
import { Empty, List, Collapse } from 'antd';
import type { HistoryData, HistoryDataItem } from '@shared/types';
import { HistoryOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSermonLookup, useActiveTabTitle } from '@renderer/hooks';

const { Panel } = Collapse;

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
            >
                {histories.map((h) => (
                    <Panel header={h.date} key={h.id}>
                        {key === h.id && (
                            <List
                                itemLayout="horizontal"
                                dataSource={historyItems.filter((i) => getSermon(i.documentTitle))}
                                renderItem={(item) => (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={<HistoryOutlined />}
                                            title={
                                                <a>
                                                    <DocumentViewer name={item.documentTitle}>
                                                        {getSermon(item.documentTitle)?.title ??
                                                            item.documentTitle}
                                                    </DocumentViewer>
                                                </a>
                                            }
                                            description={`${item.date} - ${item.time}`}
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Panel>
                ))}
            </Collapse>
        </>
    );
}
