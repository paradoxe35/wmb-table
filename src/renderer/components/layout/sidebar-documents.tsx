import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Button, Card, Tree, Divider, Select, Tag, Typography } from 'antd';
import { SoundOutlined, GlobalOutlined } from '@ant-design/icons';
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
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { LANGUAGE_EVENT } from '@renderer/utils/events';

const { DirectoryTree } = Tree;
const { Search } = Input;

export default function SidebarDocuments() {
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
                    { name: 'Tous', active: true },
                    { name: 'Années', active: false },
                    { name: 'Alphabet', active: false },
                    { name: 'Ajoutés', active: false },
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
                        {index === 0 && <DocumentSearch />}
                        {index === 1 && (
                            <ContainerScrollY>
                                <div className="mt-2" />
                                <DocumentByYears />
                            </ContainerScrollY>
                        )}
                        {index === 2 && <DocumentByAlphabetic />}
                        {index === 3 && (
                            <>
                                <div className="mt-2" />
                                <DocumentsAdded />
                            </>
                        )}
                    </div>
                )}
            </PanelGroup>
        </div>
    );
}

const DocumentsAdded = () => {
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const openCustomDocument = useOpenCustomDocument();

    return (
        <ContainerScrollY style={{ paddingLeft: '10px' }}>
            {customDocuments.map((d, i) => (
                <div
                    key={d.id || i}
                    className={`sidebar-item ${activeTitle === d.title ? 'sidebar-item--active' : ''}`}
                    onClick={() => openCustomDocument(d.title, d.sermonId)}
                >
                    <div className="sidebar-item__left">
                        <div className="sidebar-item__title">{d.title}</div>
                    </div>
                </div>
            ))}
        </ContainerScrollY>
    );
};

const alpha = Array.from(Array(26)).map((_e, i) => i + 65);
const alphabets = alpha.map((x) => String.fromCharCode(x));

const DocumentByAlphabetic = () => {
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
                    placeholder="Alphabet"
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
    const sermonsByYear = useSermonStore((s) => s.sermonsByYear);
    const openDocument = useOpenDocument();

    const dataTree = useMemo(
        () =>
            Object.keys(sermonsByYear)
                .sort()
                .map((year) => {
                    const docs = sermonsByYear[year]
                        .slice()
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((sermon) => ({
                            key: `${sermon.id}-${year}`,
                            title: (
                                <span
                                    title={sermon.title}
                                    onClick={() =>
                                        openDocument(
                                            sermon.title,
                                            sermon.sermonId,
                                            sermon.translationId,
                                        )
                                    }
                                >
                                    {sermon.title}
                                </span>
                            ),
                            className: 'document_grouped',
                            isLeaf: true,
                        }));
                    return {
                        title: (
                            <span>
                                {year} - ({docs.length})
                            </span>
                        ),
                        key: year,
                        children: docs,
                    };
                }),
        [sermonsByYear, openDocument],
    );

    return <DirectoryTree treeData={dataTree} />;
};

const ActiveLanguageBar = () => {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [langName, setLangName] = useState<string>('');

    useEffect(() => {
        if (!activeLanguage) return;
        window.api.languages.getInstalled().then((langs: InstalledLanguage[]) => {
            const lang = langs.find((l) => l.code === activeLanguage);
            if (lang) setLangName(lang.language);
        });
    }, [activeLanguage]);

    const openManager = () => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLanguageManager));
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
            <Typography.Text type="secondary" style={{ fontSize: '0.8em' }}>
                {langName}
            </Typography.Text>
            <Button
                type="text"
                size="small"
                icon={<GlobalOutlined />}
                onClick={openManager}
                style={{ fontSize: '0.8em' }}
            />
        </div>
    );
};

const DocumentSearch = () => {
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
                    placeholder="Recherche"
                    allowClear
                    onSearch={onSearch}
                />
                <ActiveLanguageBar />
            </Card>
            <DocumentList datas={datas} />
        </>
    );
};

const DocumentList = ({ datas }: { datas: SermonMetaWithTraductions[] }) => {
    const openDocument = useOpenDocument();
    const activeTab = useSermonStore(selectActiveTab);
    const activeTabKeyStr = activeTab ? getTabKey(activeTab) : null;
    const isEnglish = useAppStore((s) => s.activeLanguage) === 'en';
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
    const hasMultipleTraductions =
        sermon.availableTraductions && sermon.availableTraductions.length > 1;

    return (
        <div
            className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
            title={sermon.title}
            onClick={onClick}
        >
            <div className="sidebar-item__left">
                <div className="sidebar-item__title">{sermon.title}</div>
                {!isEnglish && sermon.enTitle && sermon.enTitle !== sermon.title && (
                    <div className="sidebar-item__en-title">{sermon.enTitle}</div>
                )}
                <div className="sidebar-item__date">{formatDate(sermon.dateMs)}</div>
                {hasMultipleTraductions && (
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
