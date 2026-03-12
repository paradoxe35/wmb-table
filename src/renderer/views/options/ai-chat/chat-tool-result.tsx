import { Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const TOOL_LABELS: Record<string, string> = {
    searchSermons: 'Recherche de sermons',
    getSermonContent: 'Lecture du sermon',
    searchContent: 'Recherche dans le contenu',
    getBibleVersions: 'Versions de la Bible',
    getBiblePassage: 'Passage biblique',
    getSubjects: 'Liste des sujets',
    createSubject: 'Création de sujet',
    addSermonReferenceToSubject: 'Ajout au sujet',
    addBibleReferenceToSubject: 'Ajout au sujet',
    getNotes: 'Liste des notes',
    getNoteById: 'Lecture de la note',
    createNote: 'Création de note',
    updateNoteContent: 'Mise à jour de la note',
    addSermonReferenceToNote: 'Ajout à la note',
    addBibleReferenceToNote: 'Ajout à la note',
    getLanguages: 'Langues disponibles',
    getCustomDocuments: 'Documents personnalisés',
    getCustomDocumentContent: 'Lecture du document',
};

export default function ChatToolResult({ name }: { name: string; output?: unknown }) {
    const { t } = useTranslation();
    const label = TOOL_LABELS[name] ?? name;

    return (
        <Tag icon={<SearchOutlined />} color="processing" style={{ marginTop: 4 }}>
            {t(label)}
        </Tag>
    );
}
