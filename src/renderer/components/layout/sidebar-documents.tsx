import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Card, Tree, Divider, Select, Tag } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import type { SermonMetaWithTraductions } from '@shared/types';
import ContainerScrollY from '../container-scroll-y';
import { useSermonStore, useCustomDocumentsStore, selectActiveTabTitle } from '@renderer/stores';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument, useOpenCustomDocument } from '@renderer/hooks';
import PanelGroup from './components/documents-menu';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { formatSermonDate } from '@renderer/utils/sermon-utils';

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
                    <>
                        <div
                            hidden={index !== 0}
                            style={
                                index === 0
                                    ? {
                                          display: 'flex',
                                          flexDirection: 'column',
                                          flex: 1,
                                          overflow: 'hidden',
                                      }
                                    : undefined
                            }
                        >
                            <DocumentSearch />
                        </div>
                        <div
                            hidden={index !== 1}
                            style={
                                index === 1
                                    ? {
                                          display: 'flex',
                                          flexDirection: 'column',
                                          flex: 1,
                                          overflow: 'hidden',
                                      }
                                    : undefined
                            }
                        >
                            <ContainerScrollY>
                                <div className="mt-2" />
                                <DocumentByYears />
                            </ContainerScrollY>
                        </div>
                        <div
                            hidden={index !== 2}
                            style={
                                index === 2
                                    ? {
                                          display: 'flex',
                                          flexDirection: 'column',
                                          flex: 1,
                                          overflow: 'hidden',
                                      }
                                    : undefined
                            }
                        >
                            <DocumentByAlphabetic />
                        </div>
                        <div
                            hidden={index !== 3}
                            style={
                                index === 3
                                    ? {
                                          display: 'flex',
                                          flexDirection: 'column',
                                          flex: 1,
                                          overflow: 'hidden',
                                      }
                                    : undefined
                            }
                        >
                            <div className="mt-2" />
                            <DocumentsAdded />
                        </div>
                    </>
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
                    onClick={() => openCustomDocument(d.title)}
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
    const activeTitle = useSermonStore(selectActiveTabTitle);
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
            <DocumentList datas={datas} activeTitle={activeTitle} />
        </>
    );
};

const DocumentByYears = () => {
    const sermonsByYear = useSermonStore((s) => s.sermonsByYear);
    const openDocument = useOpenDocument();

    const dataTree = Object.keys(sermonsByYear)
        .sort()
        .map((year) => {
            const docs = sermonsByYear[year]
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((sermon) => ({
                    key: `${sermon.id}-${year}`,
                    title: (
                        <span title={sermon.title} onClick={() => openDocument(sermon.title)}>
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
        });

    return <DirectoryTree treeData={dataTree} />;
};

const DocumentSearch = () => {
    const sermons = useSermonStore((s) => s.sermons);
    const setSermons = useSermonStore((s) => s.setSermons);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const setLoaded = useAppStore((s) => s.setLoaded);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [datas, setDatas] = useState<SermonMetaWithTraductions[]>([]);

    useEffect(() => {
        setDatas(sermons);
    }, [sermons]);

    useEffect(() => {
        if (!activeLanguage) return;
        window.api.documents
            .getTitles(activeLanguage)
            .then((titles) => setSermons(titles))
            .finally(() => setLoaded(true));
    }, [activeLanguage, setSermons, setLoaded]);

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
            <Card variant="borderless">
                <Search
                    key={sermons.length}
                    placeholder="Recherche"
                    allowClear
                    onSearch={onSearch}
                />
            </Card>
            <DocumentList datas={datas} activeTitle={activeTitle} />
        </>
    );
};

const DocumentList = ({
    datas,
    activeTitle,
}: {
    datas: SermonMetaWithTraductions[];
    activeTitle: string | null;
}) => {
    const openDocument = useOpenDocument();
    const isEnglish = useAppStore((s) => s.activeLanguage) === 'en';

    const sorted = useMemo(
        () => datas.slice().sort((a, b) => a.title.localeCompare(b.title)),
        [datas],
    );

    return (
        <>
            <Divider style={{ padding: 0, margin: 0 }} />
            <ContainerScrollY className="document-list">
                {sorted.map((d, i) => (
                    <ItemOutline
                        key={d.id || i}
                        sermon={d}
                        active={activeTitle === d.title}
                        isEnglish={isEnglish}
                        onClick={() => openDocument(d.title)}
                    />
                ))}
            </ContainerScrollY>
        </>
    );
};

const ItemOutline = React.memo<{
    sermon: SermonMetaWithTraductions;
    active?: boolean;
    isEnglish: boolean;
    onClick: () => void;
}>(({ sermon, active, isEnglish, onClick }) => {
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
                <div className="sidebar-item__date">{formatSermonDate(sermon.dateMs)}</div>
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
