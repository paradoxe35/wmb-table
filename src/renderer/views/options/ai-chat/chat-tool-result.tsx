import type { ReactNode } from 'react';
import { Tag } from 'antd';
import {
    BookOutlined,
    EditOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
    GlobalOutlined,
    LinkOutlined,
    PlusOutlined,
    ReadOutlined,
    SearchOutlined,
    TagsOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface ToolMeta {
    label: string;
    icon: ReactNode;
}

const TOOL_META: Record<string, ToolMeta> = {
    searchSermons: { label: 'Recherche de sermons', icon: <SearchOutlined /> },
    getSermonContent: { label: 'Lecture du sermon', icon: <ReadOutlined /> },
    searchContent: { label: 'Recherche dans le contenu', icon: <SearchOutlined /> },
    getBibleVersions: { label: 'Versions de la Bible', icon: <BookOutlined /> },
    getBiblePassage: { label: 'Passage biblique', icon: <BookOutlined /> },
    getSubjects: { label: 'Liste des sujets', icon: <TagsOutlined /> },
    createSubject: { label: 'Création de sujet', icon: <PlusOutlined /> },
    addSermonReferenceToSubject: { label: 'Ajout au sujet', icon: <LinkOutlined /> },
    addBibleReferenceToSubject: { label: 'Ajout au sujet', icon: <LinkOutlined /> },
    getNotes: { label: 'Liste des notes', icon: <FileTextOutlined /> },
    getNoteById: { label: 'Lecture de la note', icon: <FileTextOutlined /> },
    createNote: { label: 'Création de note', icon: <EditOutlined /> },
    updateNoteContent: { label: 'Mise à jour de la note', icon: <EditOutlined /> },
    addSermonReferenceToNote: { label: 'Ajout à la note', icon: <LinkOutlined /> },
    addBibleReferenceToNote: { label: 'Ajout à la note', icon: <LinkOutlined /> },
    getLanguages: { label: 'Langues disponibles', icon: <GlobalOutlined /> },
    getCustomDocuments: { label: 'Documents personnalisés', icon: <FolderOpenOutlined /> },
    getCustomDocumentContent: { label: 'Lecture du document', icon: <ReadOutlined /> },
};

export default function ChatToolResult({ name }: { name: string }) {
    const { t } = useTranslation();
    const meta = TOOL_META[name];
    const label = meta?.label ?? name;
    const icon = meta?.icon ?? <SearchOutlined />;

    return (
        <Tag icon={icon} color="processing" style={{ fontSize: '0.8em' }}>
            {t(label)}
        </Tag>
    );
}
