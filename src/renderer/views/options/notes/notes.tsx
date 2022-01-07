import { Button, Card, Empty, Input, Space, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NoteItem } from '@localtypes/index';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { simpleRegExp, strNormalize } from '@modules/shared/searchable';

export function Notes({
  setWorkingNote,
}: {
  setWorkingNote: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [loaded, setLoaded] = useState<boolean>(false);

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const odatas = useRef<NoteItem[]>([]);

  useEffect(() => {
    sendIpcRequest<NoteItem[]>(IPC_EVENTS.notes_items)
      .then((notes) => {
        odatas.current = notes;
        setNotes(notes);
      })
      .then(() => setLoaded(true));
  }, []);

  const handleDeletion = (note: NoteItem) => {
    sendIpcRequest(IPC_EVENTS.notes_items_delete, note._id).then(() => {
      odatas.current = odatas.current.filter((d) => d._id !== note._id);
      setNotes(odatas.current);
    });
  };

  const newNote = () => {
    sendIpcRequest<NoteItem>(IPC_EVENTS.notes_items_store).then((note) => {
      setWorkingNote(note._id);
    });
  };

  const editDocument = (note: NoteItem) => {
    setWorkingNote(note._id);
  };

  const onSearch = useCallback((value: string) => {
    if (odatas.current.length) {
      setNotes(
        odatas.current.filter((d) =>
          simpleRegExp(value).test(strNormalize(d.name))
        )
      );
    }
  }, []);

  return (
    <>
      <Space direction="vertical">
        <Space direction="horizontal">
          <Button onClick={newNote} icon={<PlusOutlined />}>
            Nouvelle note
          </Button>

          <Input.Search
            placeholder="Recherche"
            allowClear
            onSearch={onSearch}
          />
        </Space>

        {notes.length > 0 && (
          <Space direction="horizontal" wrap={true}>
            {notes.map((note) => (
              <Card
                key={note._id}
                style={{ width: 210 }}
                actions={[
                  <EditOutlined
                    key="edit"
                    onClick={() => editDocument(note)}
                  />,
                  <DeleteBtn confirm={() => handleDeletion(note)} />,
                ]}
              >
                <Card.Meta
                  title={
                    <Typography.Text title={note.name} type="secondary">
                      {note.name}
                    </Typography.Text>
                  }
                />
              </Card>
            ))}
          </Space>
        )}
      </Space>

      {loaded && notes.length < 1 && (
        <div className="flex flex-center">
          <Empty />
        </div>
      )}
    </>
  );
}
