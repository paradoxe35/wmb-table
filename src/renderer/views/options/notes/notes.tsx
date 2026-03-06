import { Button, Card, Empty, Input, Space, Typography, message } from 'antd';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { NoteItem } from '@shared/types';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';

export function Notes({
    setWorkingNote,
}: {
    setWorkingNote: Dispatch<SetStateAction<string | null>>;
}) {
    const [loaded, setLoaded] = useState<boolean>(false);

    const [notes, setNotes] = useState<NoteItem[]>([]);
    const odatas = useRef<NoteItem[]>([]);

    useEffect(() => {
        window.api.notes
            .getAll()
            .then((notes) => {
                odatas.current = notes;
                setNotes(notes);
            })
            .then(() => setLoaded(true));
    }, []);

    const handleDeletion = (note: NoteItem) => {
        window.api.notes.delete(note.id).then(() => {
            odatas.current = odatas.current.filter((d) => d.id !== note.id);
            setNotes(odatas.current);
            message.success('Note supprimée');
        });
    };

    const newNote = () => {
        window.api.notes.create('Nouvelle note').then((note) => {
            setWorkingNote(note.id);
        });
    };

    const editDocument = (note: NoteItem) => {
        setWorkingNote(note.id);
    };

    const onSearch = useCallback((value: string) => {
        if (odatas.current.length) {
            setNotes(odatas.current.filter((d) => simpleRegExp(value).test(strNormalize(d.name))));
        }
    }, []);

    return (
        <>
            <Space orientation="vertical">
                <Space orientation="horizontal">
                    <Button onClick={newNote} icon={<PlusOutlined />}>
                        Nouvelle note
                    </Button>

                    <Input.Search placeholder="Recherche" allowClear onSearch={onSearch} />
                </Space>

                {notes.length > 0 && (
                    <div className="notes-grid">
                        {notes.map((note) => (
                            <Card
                                key={note.id}
                                className="note-card"
                                onClick={() => editDocument(note)}
                                actions={[
                                    <EditOutlined key="edit" />,
                                    <span key="delete" onClick={(e) => e.stopPropagation()}>
                                        <DeleteBtn confirm={() => handleDeletion(note)} />
                                    </span>,
                                ]}
                            >
                                <Card.Meta
                                    title={
                                        <Typography.Text title={note.name}>
                                            {note.name}
                                        </Typography.Text>
                                    }
                                />
                            </Card>
                        ))}
                    </div>
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
