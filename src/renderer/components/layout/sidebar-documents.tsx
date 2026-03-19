import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Card, Divider, Segmented, Select, Tag, Typography } from 'antd';
import { SoundOutlined, GlobalOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { Virtuoso } from 'react-virtuoso';
import type { InstalledLanguage, SermonMetaWithTraductions } from '@shared/types';
import { getTabKey } from '@shared/types';
import ContainerScrollY from '../container-scroll-y';
import {
    useSermonStore,
    useCustomDocumentsStore,
    selectActiveTab,
    selectActiveTabTitle,
} from '@renderer/stores';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument, useOpenCustomDocument, useFormatSermonDate } from '@renderer/hooks';
import PanelGroup from './components/documents-menu';
import SidebarBibleBrowser from './sidebar-bible-browser';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { LANGUAGE_EVENT, CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import { interactiveProps } from '@renderer/utils/interactive';

const { Search } = Input;

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export default function SidebarDocuments() {
    const { t } = useTranslation();
    const sidebarHidden = useAppStore((s) => s.sidebarHidden);

    return (
        <div
            style={{
                width: sidebarHidden ? 0 : 300,
                opacity: sidebarHidden ? 0 : 1,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition:
                    'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            className="layout__sidebar"
        >
            <PanelGroup
                tabs={[
                    { name: t('Prédications'), active: true },
                    { name: t('Bible'), active: false },
                    { name: t('Documents'), active: false },
                ]}
            >
                {(index: number) => (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            overflow: 'hidden',
                        }}
                    >
                        {index === 0 && <SermonsTab />}
                        {index === 1 && <SidebarBibleBrowser />}
                        {index === 2 && <DocumentsAdded />}
                    </div>
                )}
            </PanelGroup>
        </div>
    );
}

const openCustomDocumentModal = () => {
    window.dispatchEvent(new Event(CUSTOM_DOCUMENT_EVENT.openModal));
};

const DocumentsAdded = () => {
    const { t } = useTranslation();
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const openCustomDocument = useOpenCustomDocument();

    if (customDocuments.length === 0) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem 1rem',
                    gap: 12,
                    flex: 1,
                }}
            >
                <FileTextOutlined style={{ fontSize: 'var(--fs-9xl)', opacity: 0.3 }} />
                <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
                    {t('Aucun document ajouté')}
                </Typography.Text>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCustomDocumentModal}>
                    {t('Ajouter un document')}
                </Button>
            </div>
        );
    }

    return (
        <>
            <div style={{ padding: '8px 10px 4px', display: 'flex', justifyContent: 'center' }}>
                <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={openCustomDocumentModal}
                >
                    {t('Gérer')}
                </Button>
            </div>
            <Divider style={{ padding: 0, margin: 0 }} />
            <div className="document-list" style={{ flex: 1 }}>
                <ContainerScrollY>
                    {customDocuments.map((d, i) => (
                        <div
                            key={d.id || i}
                            className={`sidebar-item ${activeTitle === d.title ? 'sidebar-item--active' : ''}`}
                            {...interactiveProps(() => openCustomDocument(d.title, d.sermonId))}
                            title={d.title}
                        >
                            <div className="sidebar-item__left">
                                <div className="sidebar-item__title">{d.title}</div>
                                <div className="sidebar-item__date">
                                    {new Date(d.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="sidebar-item__right" style={{ alignSelf: 'center' }}>
                                <FileTextOutlined style={{ opacity: 0.4 }} />
                            </div>
                        </div>
                    ))}
                </ContainerScrollY>
            </div>
        </>
    );
};

const alpha = Array.from(Array(26)).map((_e, i) => i + 65);
const alphabets = alpha.map((x) => String.fromCharCode(x));

const DocumentByAlphabetic = () => {
    const { t } = useTranslation();
    const sermons = useSermonStore((s) => s.sermons);
    const [datas, setDatas] = useState<SermonMetaWithTraductions[]>([]);
    const alphabet = useRef(alphabets[0]);

    const onSearch = useCallback(() => {
        const newDocs = sermons.filter((d) => {
            return strNormalize(d.title).charAt(0).toUpperCase() === alphabet.current;
        });
        setDatas(newDocs);
    }, [sermons]);

    const onChangeAlphabetic = useCallback(
        (value: string) => {
            alphabet.current = value;
            onSearch();
        },
        [onSearch],
    );

    useEffect(() => {
        onSearch();
    }, [onSearch]);

    return (
        <>
            <Card variant="borderless">
                <Select
                    className="w-100 max-w-100"
                    placeholder={t('Alphabet')}
                    defaultValue={alphabets[0]}
                    onChange={onChangeAlphabetic}
                    options={alphabets.map((al) => ({ value: al, label: al }))}
                />
            </Card>
            <DocumentList datas={datas} />
        </>
    );
};

const DocumentByYears = () => {
    const { t } = useTranslation();
    const sermonsByYear = useSermonStore((s) => s.sermonsByYear);
    const [datas, setDatas] = useState<SermonMetaWithTraductions[]>([]);
    const selectedYear = useRef<string>('');

    const years = useMemo(
        () => Object.keys(sermonsByYear).sort((a, b) => b.localeCompare(a)),
        [sermonsByYear],
    );

    const onChangeYear = useCallback(
        (value: string) => {
            selectedYear.current = value;
            setDatas(sermonsByYear[value] ?? []);
        },
        [sermonsByYear],
    );

    // Auto-select first year on load
    useEffect(() => {
        if (years.length > 0 && !selectedYear.current) {
            onChangeYear(years[0]);
        }
    }, [years, onChangeYear]);

    const yearOptions = useMemo(
        () =>
            years.map((y) => ({
                value: y,
                label: `${y} (${sermonsByYear[y]?.length ?? 0})`,
            })),
        [years, sermonsByYear],
    );

    return (
        <>
            <Card variant="borderless">
                <Select
                    className="w-100 max-w-100"
                    placeholder={t('Année')}
                    value={selectedYear.current || undefined}
                    onChange={onChangeYear}
                    options={yearOptions}
                />
            </Card>
            <DocumentList datas={datas} />
        </>
    );
};

const ContentLanguageBar = () => {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [langName, setLangName] = useState<string>('');

    useEffect(() => {
        if (!contentLanguage) return;
        window.api.languages
            .getInstalled()
            .then((langs: InstalledLanguage[]) => {
                const lang = langs.find((l) => l.code === contentLanguage);
                if (lang) setLangName(lang.language);
            })
            .catch(() => {});
    }, [contentLanguage]);

    const openManager = () => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLibrary));
    };

    if (!langName) return null;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2px',
                marginTop: 6,
            }}
        >
            <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                {t('Bibliothèque')}: {langName}
            </Typography.Text>
            <Button
                type="text"
                size="small"
                icon={<GlobalOutlined />}
                onClick={openManager}
                style={{ fontSize: 'var(--fs-rel-lg)' }}
            />
        </div>
    );
};

const DocumentSearch = () => {
    const { t } = useTranslation();
    const sermons = useSermonStore((s) => s.sermons);
    const [datas, setDatas] = useState<SermonMetaWithTraductions[]>([]);

    useEffect(() => {
        setDatas(sermons);
    }, [sermons]);

    const onSearch = useCallback(
        (value: string) => {
            if (sermons.length) {
                const filtered = sermons.filter((d) => {
                    return simpleRegExp(value).test(strNormalize(d.title));
                });
                setDatas(filtered);
            }
        },
        [sermons],
    );

    return (
        <>
            <Card variant="borderless" styles={{ body: { paddingBottom: 8 } }}>
                <Search
                    key={sermons.length}
                    placeholder={t('Recherche')}
                    allowClear
                    onSearch={onSearch}
                />
                <ContentLanguageBar />
            </Card>
            <DocumentList datas={datas} />
        </>
    );
};

// ---------------------------------------------------------------------------
// Sermon filter modes for the Prédications tab
// ---------------------------------------------------------------------------

type SermonFilterMode = 'Recherche' | 'Années' | 'A-Z';

const SERMON_FILTER_OPTIONS: SermonFilterMode[] = ['Recherche', 'Années', 'A-Z'];

const SermonFilterContent: Record<SermonFilterMode, React.FC> = {
    Recherche: DocumentSearch,
    Années: DocumentByYears,
    'A-Z': DocumentByAlphabetic,
};

function SermonsTab() {
    const { t } = useTranslation();
    const [filterMode, setFilterMode] = useState<SermonFilterMode>('Recherche');
    const FilterComponent = SermonFilterContent[filterMode];

    const segmentedOptions = useMemo(
        () => SERMON_FILTER_OPTIONS.map((key) => ({ label: t(key), value: key })),
        [t],
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px 4px', display: 'flex', justifyContent: 'center' }}>
                <Segmented
                    size="small"
                    options={segmentedOptions}
                    value={filterMode}
                    onChange={(v) => setFilterMode(v as SermonFilterMode)}
                />
            </div>
            <FilterComponent />
        </div>
    );
}

const DocumentList = ({ datas }: { datas: SermonMetaWithTraductions[] }) => {
    const openDocument = useOpenDocument();
    const activeTab = useSermonStore(selectActiveTab);
    const activeTabKeyStr = activeTab ? getTabKey(activeTab) : null;
    const isEnglish = useAppStore((s) => s.contentLanguage) === 'en';
    const formatDate = useFormatSermonDate();

    const sorted = useMemo(
        () => datas.slice().sort((a, b) => a.title.localeCompare(b.title)),
        [datas],
    );

    return (
        <>
            <Divider style={{ padding: 0, margin: 0 }} />
            <div className="document-list" style={{ flex: 1 }}>
                <Virtuoso
                    data={sorted}
                    itemContent={(_index, d) => {
                        const sermonKey = getTabKey({ title: d.title, sermonId: d.sermonId });
                        return (
                            <ItemOutline
                                sermon={d}
                                active={activeTabKeyStr === sermonKey}
                                isEnglish={isEnglish}
                                formatDate={formatDate}
                                onClick={() => openDocument(d.title, d.sermonId, d.translationId)}
                            />
                        );
                    }}
                />
            </div>
        </>
    );
};

const ItemOutline = React.memo<{
    sermon: SermonMetaWithTraductions;
    active?: boolean;
    isEnglish: boolean;
    formatDate: (dateMs: number) => string;
    onClick: () => void;
}>(({ sermon, active, isEnglish, formatDate, onClick }) => {
    const hasTraductions = sermon.availableTraductions && sermon.availableTraductions.length > 0;

    return (
        <div
            className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
            title={sermon.title}
            {...interactiveProps(onClick)}
        >
            <div className="sidebar-item__left">
                <div className="sidebar-item__title">{sermon.title}</div>
                {!isEnglish && sermon.enTitle && sermon.enTitle !== sermon.title && (
                    <div className="sidebar-item__en-title">{sermon.enTitle}</div>
                )}
                <div className="sidebar-item__date">{formatDate(sermon.dateMs)}</div>
                {hasTraductions && (
                    <div className="sidebar-item__tags">
                        {sermon.availableTraductions.map((t) => (
                            <Tag key={t.translationId} color="blue" className="translation-tag">
                                {t.traductionName ?? `T${t.translationId}`}
                            </Tag>
                        ))}
                    </div>
                )}
            </div>
            <div className="sidebar-item__right">
                {sermon.cityState && <div className="sidebar-item__city">{sermon.cityState}</div>}
                {sermon.audioLink && (
                    <div className="sidebar-item__audio">
                        <SoundOutlined />
                    </div>
                )}
            </div>
        </div>
    );
});
ItemOutline.displayName = 'ItemOutline';
