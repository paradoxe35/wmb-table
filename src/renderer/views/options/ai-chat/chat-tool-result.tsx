import type { ReactNode } from 'react';
import { Tag } from 'antd';
import {
    BookOutlined,
    BulbOutlined,
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
    /** Tag color override (default: "processing") */
    color?: string;
}

const TOOL_META: Record<string, ToolMeta> = {
    searchSermons: { label: 'Recherche de sermons', icon: <SearchOutlined /> },
    getSermonContent: { label: 'Lecture du sermon', icon: <ReadOutlined /> },
    searchContent: { label: 'Recherche dans le contenu', icon: <SearchOutlined /> },
    getBibleVersions: { label: 'Versions de la Bible', icon: <BookOutlined /> },
    getBiblePassage: { label: 'Passage biblique', icon: <BookOutlined /> },
    searchBible: { label: 'Recherche biblique', icon: <SearchOutlined /> },
    getSubjects: { label: 'Liste des sujets', icon: <TagsOutlined /> },
    getSubjectById: { label: 'Lecture du sujet', icon: <TagsOutlined /> },
    createSubject: { label: 'Création de sujet', icon: <PlusOutlined /> },
    addSermonReferenceToSubject: { label: 'Ajout au sujet', icon: <LinkOutlined /> },
    addBibleReferenceToSubject: { label: 'Ajout au sujet', icon: <LinkOutlined /> },
    removeSubjectReference: { label: 'Retrait du sujet', icon: <LinkOutlined /> },
    getNotes: { label: 'Liste des notes', icon: <FileTextOutlined /> },
    getNoteById: { label: 'Lecture de la note', icon: <FileTextOutlined /> },
    createNote: { label: 'Création de note', icon: <EditOutlined /> },
    updateNoteContent: { label: 'Mise à jour de la note', icon: <EditOutlined /> },
    editNote: { label: 'Modification de la note', icon: <EditOutlined /> },
    appendToNote: { label: 'Ajout à la note', icon: <EditOutlined /> },
    getLanguages: { label: 'Langues disponibles', icon: <GlobalOutlined /> },
    getCustomDocuments: { label: 'Documents personnalisés', icon: <FolderOpenOutlined /> },
    searchCustomDocuments: { label: 'Recherche dans les documents', icon: <SearchOutlined /> },
    getCustomDocumentContent: { label: 'Lecture du document', icon: <ReadOutlined /> },
    researchTopic: { label: 'Recherche approfondie', icon: <BulbOutlined />, color: 'purple' },
    readSermon: { label: 'Lecture du sermon', icon: <ReadOutlined />, color: 'purple' },
};

/** Agent-prefixed names like "researchTopic:searchSermons" → resolve the inner tool. */
function resolveToolMeta(name: string): { meta: ToolMeta | undefined; isAgent: boolean } {
    const direct = TOOL_META[name];
    if (direct) return { meta: direct, isAgent: false };

    const colonIndex = name.indexOf(':');
    if (colonIndex > 0) {
        const innerName = name.slice(colonIndex + 1);
        const innerMeta = TOOL_META[innerName];
        if (innerMeta) {
            return { meta: { ...innerMeta, color: 'geekblue' }, isAgent: true };
        }
    }

    return { meta: undefined, isAgent: false };
}

/** U+203A is in every UI font, unlike "↳", which shows as a missing glyph on some systems. */
const SUB_AGENT_STEP_MARK = '› ';

export default function ChatToolResult({
    name,
    count,
    incomplete = false,
}: {
    name: string;
    count?: number;
    incomplete?: boolean;
}) {
    const { t } = useTranslation();
    const { meta, isAgent } = resolveToolMeta(name);
    const label = meta?.label ?? name;
    const icon = meta?.icon ?? <SearchOutlined />;
    const color = incomplete ? 'warning' : (meta?.color ?? 'processing');
    const prefix = isAgent ? SUB_AGENT_STEP_MARK : '';
    const suffix = count && count > 1 ? ` x${count}` : '';

    return (
        <Tag icon={icon} color={color} style={{ fontSize: 'var(--fs-rel-lg)' }}>
            {prefix}
            {t(label)}
            {suffix}
            {incomplete ? ` · ${t('Recherche incomplète')}` : null}
        </Tag>
    );
}
