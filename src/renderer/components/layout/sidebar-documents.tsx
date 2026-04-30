import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Card, Divider, Segmented, Select, Tag, Typography } from 'antd';
import { SoundOutlined, GlobalOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { Virtuoso } from 'react-virtuoso';
import type { SermonListItemWithTranslations } from '@shared/types';
import { getTabKey } from '@shared/types';
import { getLanguageDisplayName } from '@shared/tts.types';
import ContainerScrollY from '../container-scroll-y';
import {
    useDocumentTabsStore,
    useSermonStore,
    useSermonsByYear,
    useCustomDocumentsStore,
    selectActiveTab,
    useSidebarDocumentsStore,
    type SermonFilterMode,
    type SidebarPanelTab,
} from '@renderer/stores';
import { useAppStore, useInstalledLanguagesStore } from '@renderer/stores';
import { useOpenDocumentRequest, useFormatSermonDate } from '@renderer/hooks';
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
    const panelTab = useSidebarDocumentsStore((s) => s.panelTab);
    const setPanelTab = useSidebarDocumentsStore((s) => s.setPanelTab);

    const tabs = [
        <SermonsTab key="sermons" />,
        <SidebarBibleBrowser key="bible" />,
        <DocumentsAdded key="documents" />,
    ];

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
                tabs={[{ name: t('Prédications') }, { name: t('Bible') }, { name: t('Documents') }]}
                activeIndex={panelTab}
                onChange={(i) => setPanelTab(i as SidebarPanelTab)}
            >
                {(index: number) =>
                    tabs.map((TabContent, i) => (
                        <div
                            key={i}
                            style={{
                                display: index === i ? 'flex' : 'none',
                                flexDirection: 'column',
                                flex: 1,
                                overflow: 'hidden',
                            }}
                        >
                            {TabContent}
                        </div>
                    ))
                }
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
    const activeTab = useDocumentTabsStore(selectActiveTab);
    const openDocumentRequest = useOpenDocumentRequest();
    const activeCustomDocumentId = activeTab?.type === 'custom' ? activeTab.documentId : null;

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
                    {t('Gérer mes documents')}
                </Button>
            </div>
            <Divider style={{ padding: 0, margin: 0 }} />
            <div className="document-list" style={{ flex: 1 }}>
                <ContainerScrollY>
                    {customDocuments.map((d, i) => (
                        <div
                            key={d.id || i}
                            className={`sidebar-item ${activeCustomDocumentId === d.id ? 'sidebar-item--active' : ''}`}
                            {...interactiveProps(() =>
                                openDocumentRequest({
                                    title: d.title,
                                    documentType: 'custom',
                                    customDocumentId: d.id,
                                }),
                            )}
                            title={d.title}
                        >
                            <div className="sidebar-item__left">
                                <div className="sidebar-item__title">{d.title}</div>
                                <div className="sidebar-item__date">
                                    {new Date(d.createdAt).toLocaleDateString()}
                                </div>
                                <div className="sidebar-item__date">
                                    {getLanguageDisplayName(d.languageCode)}
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
    const alphabet = useSidebarDocumentsStore((s) => s.sermonAlphabet);
    const setAlphabet = useSidebarDocumentsStore((s) => s.setSermonAlphabet);

    const items = useMemo(
        () => sermons.filter((d) => strNormalize(d.title).charAt(0).toUpperCase() === alphabet),
        [sermons, alphabet],
    );

    return (
        <>
            <Card variant="borderless">
                <Select
                    className="w-100 max-w-100"
                    placeholder={t('Alphabet')}
                    value={alphabet}
                    onChange={setAlphabet}
                    options={alphabets.map((al) => ({ value: al, label: al }))}
                />
            </Card>
            <DocumentList items={items} />
        </>
    );
};

const DocumentByYears = () => {
    const { t } = useTranslation();
    const sermonsByYear = useSermonsByYear();
    const selectedYear = useSidebarDocumentsStore((s) => s.sermonSelectedYear);
    const setSelectedYear = useSidebarDocumentsStore((s) => s.setSermonSelectedYear);

    const years = useMemo(
        () => Object.keys(sermonsByYear).sort((a, b) => b.localeCompare(a)),
        [sermonsByYear],
    );

    const effectiveYear = selectedYear ?? years[0] ?? null;
    const items = effectiveYear ? (sermonsByYear[effectiveYear] ?? []) : [];

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
                    value={effectiveYear ?? undefined}
                    onChange={setSelectedYear}
                    options={yearOptions}
                />
            </Card>
            <DocumentList items={items} />
        </>
    );
};

const ContentLanguageBar = () => {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const installedLanguages = useInstalledLanguagesStore((s) => s.installedLanguages);
    const langName = installedLanguages.find((l) => l.code === contentLanguage)?.language ?? '';

    const openManager = () => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLibrary));
    };

    if (!langName) {
        return null;
    }

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
    const query = useSidebarDocumentsStore((s) => s.sermonSearchQuery);
    const setQuery = useSidebarDocumentsStore((s) => s.setSermonSearchQuery);

    const items = useMemo(() => {
        if (!query) return sermons;
        const matcher = simpleRegExp(query);
        return sermons.filter((d) => matcher.test(strNormalize(d.title)));
    }, [sermons, query]);

    return (
        <>
            <Card variant="borderless" styles={{ body: { paddingBottom: 8 } }}>
                <Search
                    placeholder={t('Recherche')}
                    allowClear
                    defaultValue={query}
                    onSearch={setQuery}
                />
                <ContentLanguageBar />
            </Card>
            <DocumentList items={items} />
        </>
    );
};

// ---------------------------------------------------------------------------
// Sermon filter modes for the Prédications tab
// ---------------------------------------------------------------------------

const SERMON_FILTER_OPTIONS: { mode: SermonFilterMode; labelKey: string }[] = [
    { mode: 'search', labelKey: 'Recherche' },
    { mode: 'years', labelKey: 'Années' },
    { mode: 'alphabet', labelKey: 'A-Z' },
];

const SermonFilterContent: Record<SermonFilterMode, React.FC> = {
    search: DocumentSearch,
    years: DocumentByYears,
    alphabet: DocumentByAlphabetic,
};

function SermonsTab() {
    const { t } = useTranslation();
    const filterMode = useSidebarDocumentsStore((s) => s.sermonFilter);
    const setFilterMode = useSidebarDocumentsStore((s) => s.setSermonFilter);
    const FilterComponent = SermonFilterContent[filterMode];

    const segmentedOptions = useMemo(
        () =>
            SERMON_FILTER_OPTIONS.map(({ mode, labelKey }) => ({
                label: t(labelKey),
                value: mode,
            })),
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

const DocumentList = ({ items }: { items: SermonListItemWithTranslations[] }) => {
    const openDocumentRequest = useOpenDocumentRequest();
    const activeTab = useDocumentTabsStore(selectActiveTab);
    const activeTabKeyStr = activeTab ? getTabKey(activeTab) : null;
    const isEnglish = useAppStore((s) => s.contentLanguage) === 'en';
    const formatDate = useFormatSermonDate();

    const sorted = useMemo(
        () => items.slice().sort((a, b) => a.title.localeCompare(b.title)),
        [items],
    );

    return (
        <>
            <Divider style={{ padding: 0, margin: 0 }} />
            <div className="document-list" style={{ flex: 1 }}>
                <Virtuoso
                    data={sorted}
                    itemContent={(_index, d) => {
                        const sermonKey = getTabKey({
                            type: 'sermon',
                            documentId: d.sermonId,
                            translationId: d.translationId,
                            languageCode: d.languageCode,
                        });

                        return (
                            <ItemOutline
                                sermon={d}
                                active={activeTabKeyStr === sermonKey}
                                isEnglish={isEnglish}
                                formatDate={formatDate}
                                onClick={() => {
                                    openDocumentRequest({
                                        title: d.title,
                                        documentType: 'sermon',
                                        sermonId: d.sermonId,
                                        translationId: d.translationId,
                                        languageCode: d.languageCode,
                                    });
                                }}
                            />
                        );
                    }}
                />
            </div>
        </>
    );
};

const ItemOutline = React.memo<{
    sermon: SermonListItemWithTranslations;
    active?: boolean;
    isEnglish: boolean;
    formatDate: (dateMs: number) => string;
    onClick: () => void;
}>(({ sermon, active, isEnglish, formatDate, onClick }) => {
    const hasTranslations = sermon.availableTranslations && sermon.availableTranslations.length > 0;

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
                {hasTranslations && (
                    <div className="sidebar-item__tags">
                        {sermon.availableTranslations.map((t) => (
                            <Tag key={t.translationId} color="blue" className="translation-tag">
                                {t.translationName ?? `T${t.translationId}`}
                            </Tag>
                        ))}
                    </div>
                )}
            </div>
            <div className="sidebar-item__right">
                {sermon.cityState && <div className="sidebar-item__city">{sermon.cityState}</div>}
                {sermon.hasAudio && (
                    <div className="sidebar-item__audio">
                        <SoundOutlined />
                    </div>
                )}
            </div>
        </div>
    );
});
ItemOutline.displayName = 'ItemOutline';
