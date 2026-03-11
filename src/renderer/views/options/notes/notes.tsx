import { Button, Card, Empty, Input, Space, Spin, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            .catch(() => {
                message.error(t('Erreur lors du chargement des notes'));
            })
            .finally(() => setLoaded(true));
    }, []);

    const handleDeletion = (note: NoteItem) => {
        window.api.notes
            .delete(note.id)
            .then(() => {
                odatas.current = odatas.current.filter((d) => d.id !== note.id);
                setNotes(odatas.current);
                message.success(t('Note supprimée'));
            })
            .catch(() => {
                message.error(t('Erreur lors de la suppression'));
            });
    };

    const newNote = () => {
        window.api.notes
            .create('Nouvelle note')
            .then((note) => {
                setWorkingNote(note.id);
            })
            .catch(() => {
                message.error(t('Erreur lors de la création de la note'));
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

    if (!loaded) {
        return (
            <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                <Spin />
            </div>
        );
    }

    return (
        <>
            <Space orientation="vertical">
                <Space orientation="horizontal">
                    <Button onClick={newNote} icon={<PlusOutlined />}>
                        {t('Nouvelle note')}
                    </Button>

                    <Input.Search placeholder={t('Recherche')} allowClear onSearch={onSearch} />
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

            {notes.length < 1 && (
                <div className="flex flex-center">
                    <Empty description={t('Aucune note')} />
                </div>
            )}
        </>
    );
}
