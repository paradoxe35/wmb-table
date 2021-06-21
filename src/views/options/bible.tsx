import { Button, Collapse, List, Menu, Space, Spin, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import LoadByVisibility from '../../components/load-by-visibility';
import { SearchOutlined } from '@ant-design/icons';
import { BibleIcons } from '../../components/icons';
import {
  BibleBook,
  BibleIndex,
  BibleIndexValue,
  BookRequest,
} from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { LoadingOutlined } from '@ant-design/icons';

export default function Bible() {
  const [menu, setMenu] = useState('bible');

  const handleClick = (e: any) => {
    setMenu(e.key);
  };

  return (
    <LoadByVisibility>
      <Menu onClick={handleClick} selectedKeys={[menu]} mode="horizontal">
        <Menu.Item key="bible" icon={<BibleIcons />}>
          Bible
        </Menu.Item>
        <Menu.Item key="search" icon={<SearchOutlined />}>
          Recherche
        </Menu.Item>
      </Menu>
      <div className="mt-2 mb-3" />
      <div hidden={menu !== 'bible'}>
        <BibleContent />
      </div>
      <div hidden={menu !== 'search'}>
        <SearchContent />
      </div>
    </LoadByVisibility>
  );
}

function BookContent({ bookDetail }: { bookDetail: BibleIndexValue }) {
  const [chaptersKey, setChaptersKey] = useState(1);
  const [verses, setVerses] = useState<BibleBook[]>();

  useEffect(() => {
    sendIpcRequest<BibleBook[]>(IPC_EVENTS.bible_books, {
      book: bookDetail.book,
      chapter: chaptersKey.toString(),
    } as BookRequest).then((books) => setVerses(books));
  }, [chaptersKey]);

  return (
    <Collapse activeKey="1" accordion>
      <Collapse.Panel
        header={
          <Space wrap={true} direction="horizontal">
            {new Array(+bookDetail.chapters).fill(null).map((_, i) => {
              const key = i + 1;
              return (
                <Button
                  onClick={() => setChaptersKey(key)}
                  key={key}
                  type={key == chaptersKey ? 'primary' : 'dashed'}
                >
                  {i + 1}
                </Button>
              );
            })}
          </Space>
        }
        key="1"
      >
        {(!verses || verses.length === 0) && (
          <div className="flex flex-center">
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
            />
          </div>
        )}
        {verses && verses.length > 0 && (
          <List
            itemLayout="horizontal"
            dataSource={verses.sort((a, b) => +a.verse - +b.verse)}
            renderItem={(item) => (
              <List.Item key={item._id}>
                <List.Item.Meta
                  avatar={<span>{item.verse}.</span>}
                  description={
                    <Typography.Text style={{ fontSize: '1.2em' }}>
                      {item.content}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Collapse.Panel>
    </Collapse>
  );
}

function BibleTestamentContent({ bibleIndex }: { bibleIndex: BibleIndex }) {
  const [currentKey, setCurrentKey] = useState<string>();

  function onChangeKey(key: string | string[]) {
    setCurrentKey(key as string);
  }

  return (
    <Collapse onChange={onChangeKey} accordion>
      {bibleIndex &&
        Object.keys(bibleIndex).map((key) => {
          const book = bibleIndex[key];
          return (
            <Collapse.Panel header={key} key={book.book}>
              {currentKey === book.book && <BookContent bookDetail={book} />}
            </Collapse.Panel>
          );
        })}
    </Collapse>
  );
}

function BibleContent() {
  const [bibleIndex, setBibleIndex] = useState<{ [name: string]: BibleIndex }>(
    {}
  );

  useEffect(() => {
    sendIpcRequest<{ [name: string]: BibleIndex }>(
      IPC_EVENTS.bible_indexes
    ).then((indexs) => {
      setBibleIndex(indexs || {});
    });
  }, []);

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        {bibleIndex &&
          Object.keys(bibleIndex).map((key) => {
            return (
              <Space direction="vertical" style={{ width: '100%' }} key={key}>
                <Typography.Title type="secondary" level={5}>
                  {key === 'N' ? 'Nouveau' : 'Ancien'} Testament
                </Typography.Title>
                <BibleTestamentContent key={key} bibleIndex={bibleIndex[key]} />
              </Space>
            );
          })}
      </Space>
      <div className="mt-2 mb-2" />
    </>
  );
}

function SearchContent() {
  return <>Recherche</>;
}
