import React, { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  currentDocumentTabsSelector,
  defaultTitle,
  titlesDocumentSelector,
} from '@renderer/store';
import { Empty, List } from 'antd';
import { HistoryData, HistoryDataItem, HistoryDateUpload } from '@localtypes/index';
import { Collapse } from 'antd';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { getDateTime } from '@root/utils/functions';
import { HistoryOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';

const { Panel } = Collapse;

export default function History() {
  const title = useRecoilValue(currentDocumentTabsSelector);
  const [histories, setHistories] = useState<HistoryData[]>([]);

  const [key, setKey] = useState<string | null>(null);

  const [historyItems, setHistoryItems] = useState<HistoryDataItem[]>([]);

  const [reloadKey, setReloadKey] = useState(0);

  const $titles = useRecoilValue(titlesDocumentSelector);

  const onChange = (key: string | string[]) => {
    if (typeof key === 'string') setKey(key);
  };

  useEffect(() => {
    if (key && title && !defaultTitle.isDefault) {
      const history = histories.find((k) => k._id == key);
      if (history) {
        sendIpcRequest<HistoryDataItem[]>(
          IPC_EVENTS.history_data_item,
          history
        ).then((items) => {
          setHistoryItems(items);
        });
      }
    }
  }, [key, title]);

  useEffect(() => {
    let history = null;
    if (title) {
      if (!defaultTitle.isDefault) {
        const dateTime = getDateTime();
        history = {
          ...dateTime,
          documentTitle: title,
        } as HistoryDateUpload;
      }

      sendIpcRequest<HistoryData[]>(IPC_EVENTS.history_data, history).then(
        (items) => {
          setHistories(items);
        }
      );
    }
  }, [title]);

  if (process.env.NODE_ENV === 'development') {
    console.log('new history data');
  }

  useEffect(() => {
    if (histories.length > 0) {
      setKey(histories[0]._id as string);
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
        {histories.map((h) => {
          return (
            <Panel header={h.date} key={h._id as string}>
              {key === h._id && (
                <>
                  <List
                    itemLayout="horizontal"
                    dataSource={historyItems.filter(
                      (i) => $titles[i.documentTitle]
                    )}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<HistoryOutlined />}
                          title={
                            <a>
                              <DocumentViewer name={item.documentTitle}>
                                {$titles[item.documentTitle]?.name ||
                                  item.documentTitle}
                              </DocumentViewer>
                            </a>
                          }
                          description={`${item.date} - ${item.time}`}
                        />
                      </List.Item>
                    )}
                  />
                </>
              )}
            </Panel>
          );
        })}
      </Collapse>
    </>
  );
}
