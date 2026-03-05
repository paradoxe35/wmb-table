import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Card, Layout, Tree, Divider, Select } from 'antd';
import type { SermonMeta } from '@shared/types';
import ContainerScrollY from '../container-scroll-y';
import { useSermonStore, useCustomDocumentsStore, selectActiveTabTitle } from '@renderer/stores';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument } from '@renderer/hooks';
import PanelGroup from './components/documents-menu';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import LanguageSelector from '../LanguageSelector';

const { DirectoryTree } = Tree;
const { Search } = Input;
const { Sider } = Layout;

export default function SidebarDocuments() {
    const sidebarHidden = useAppStore((s) => s.sidebarHidden);

    return (
        <Sider
            hidden={sidebarHidden}
            width="265px"
            trigger={null}
            className="layout__sidebar"
            theme="light"
        >
            <LanguageSelector />
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
                        <div hidden={index !== 0}>
                            <DocumentSearch />
                        </div>
                        <div hidden={index !== 1}>
                            <ContainerScrollY>
                                <div className="mt-2" />
                                <DocumentByYears />
                            </ContainerScrollY>
                        </div>
                        <div hidden={index !== 2}>
                            <DocumentByAlphabetic />
                        </div>
                        <div hidden={index !== 3}>
                            <div className="mt-2" />
                            <DocumentsAdded />
                        </div>
                    </>
                )}
            </PanelGroup>
        </Sider>
    );
}

const DocumentsAdded = () => {
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const openDocument = useOpenDocument();

    return (
        <ContainerScrollY style={{ paddingLeft: '10px' }}>
            {customDocuments.map((d, i) => (
                <ItemOutline
                    key={d.id || i}
                    id={d.id}
                    name={d.title}
                    active={activeTitle === d.title}
                    title={d.title}
                    onClick={() => openDocument(d.title)}
                />
            ))}
        </ContainerScrollY>
    );
};

const alpha = Array.from(Array(26)).map((_e, i) => i + 65);
const alphabets = alpha.map((x) => String.fromCharCode(x));

const DocumentByAlphabetic = () => {
    const sermons = useSermonStore((s) => s.sermons);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const [datas, setDatas] = useState<SermonMeta[]>([]);
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
            <Card bordered={false}>
                <Select
                    className="w-100 max-w-100"
                    placeholder="Alphabet"
                    defaultValue={alphabets[0]}
                    onChange={onChangeAlphabetic}
                >
                    {alphabets.map((al) => (
                        <Select.Option key={al} value={al}>
                            {al}
                        </Select.Option>
                    ))}
                </Select>
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
                    key: sermon.title + year,
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
    const [datas, setDatas] = useState<SermonMeta[]>([]);

    useEffect(() => {
        setDatas(sermons);
    }, [sermons]);

    useEffect(() => {
        (window.api.documents.getTitles(activeLanguage) as Promise<SermonMeta[]>)
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
            <Card bordered={false}>
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
    datas: SermonMeta[];
    activeTitle: string | null;
}) => {
    const openDocument = useOpenDocument();

    return (
        <>
            <Divider style={{ padding: '0', margin: '0' }} />
            <ContainerScrollY style={{ paddingLeft: '22px' }}>
                {datas
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((d, i) => (
                        <ItemOutline
                            key={d.id || i}
                            id={d.id}
                            active={activeTitle === d.title}
                            name={d.title}
                            title={d.title}
                            onClick={() => openDocument(d.title)}
                        />
                    ))}
            </ContainerScrollY>
        </>
    );
};

const ItemOutline: React.FC<{
    name: string;
    id: string;
    title: string;
    active?: boolean;
    onClick: () => void;
}> = ({ title, active, onClick }) => {
    return (
        <span
            className={`smart-editable ${active ? 'active' : ''}`}
            title={title}
            onClick={onClick}
        >
            <u>
                <span></span>
            </u>
            <b className="name">{title} </b>
        </span>
    );
};
