import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
    Button,
    Col,
    Divider,
    Input,
    List,
    Modal,
    Row,
    Space,
    Typography,
    Upload,
    message,
    Progress,
} from 'antd';
import { CustomDocument, CustomDocumentUploadProgress, UploadDocument } from '@shared/types';
import { FileAddOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons';
import { DeleteBtn } from '@renderer/components/delete-btn';
import DocumentViewer from '@renderer/components/viewer/document-viewer';

import { InboxOutlined, RedoOutlined } from '@ant-design/icons';
import { DraggerProps } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';

import { Spin } from 'antd';
import { useModalVisible, useIpcRequestWithLoader } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useAppStore, useCustomDocumentsStore, useSermonStore } from '@renderer/stores';

const { Dragger } = Upload;

export default function CustomDocuments() {
    const { visible, show, hide } = useModalVisible();

    const sermons = useSermonStore((s) => s.sermons);

    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);
    const addCustomDocument = useCustomDocumentsStore((s) => s.addCustomDocument);
    const removeCustomDocument = useCustomDocumentsStore((s) => s.removeCustomDocument);

    useEffect(() => {
        window.api.app.getCustomDocuments().then((datas) => {
            setCustomDocuments(datas as CustomDocument[]);
        });
    }, []);

    useEffect(() => {
        const cleanup = window.api.on.openModalDocumentFromMain(show);
        return cleanup;
    }, []);

    return (
        <>
            <Modal
                width="80%"
                title={
                    <>
                        <Space direction="horizontal">
                            <span>Documents</span>
                            <span>-</span>
                            <div className="flex flex-center">
                                <Typography.Text type="secondary">
                                    Total({sermons.length})
                                </Typography.Text>
                            </div>
                        </Space>
                    </>
                }
                visible={visible}
                footer={[]}
                onOk={hide}
                onCancel={hide}
            >
                <Row>
                    <Col span={11}>
                        <CustomDocumentItem
                            customDocuments={customDocuments}
                            addCustomDocument={addCustomDocument}
                            removeCustomDocument={removeCustomDocument}
                            handleCancel={hide}
                        />
                    </Col>
                    <Col span={2}>
                        <Divider style={{ minHeight: '250px' }} type="vertical" />
                    </Col>
                    <Col span={11}>
                        <UploaderWrapper />
                    </Col>
                </Row>
            </Modal>
        </>
    );
}

const DisabledArea = ({ component, active }: { component: ReactElement; active: boolean }) => {
    return active ? (
        component
    ) : (
        <div className="area-wrapper">
            <div className="area-content">
                <Button type="primary" shape="circle" icon={<RedoOutlined />} />
                <br />
                <Button type="dashed" disabled>
                    Desactive
                </Button>
                <br />
                <Button type="dashed">
                    <Typography.Link target="_blank" href={process.env.DOCS_CUSTOM_DOCUMENT_LINK}>
                        Documentation
                    </Typography.Link>
                </Button>
            </div>
            {component}
        </div>
    );
};

const UploaderWrapper = () => {
    const [canUpload] = useState<boolean>(true);

    return <DisabledArea component={<Uploader />} active={canUpload} />;
};

const DocumentTitle = ({ length }: { length: number }) => {
    const appLoaded = useAppStore((s) => s.loaded);

    return (
        <Space direction="horizontal">
            <Typography.Text type="secondary">Documents ajout\u00e9s ({length})</Typography.Text>
            {!appLoaded && <Spin indicator={<LoadingOutlined spin />} />}
        </Space>
    );
};

function CustomDocumentItem({
    handleCancel,
    customDocuments,
    addCustomDocument,
    removeCustomDocument,
}: {
    handleCancel: () => void;
    customDocuments: CustomDocument[];
    addCustomDocument: (doc: CustomDocument) => void;
    removeCustomDocument: (id: string) => void;
}) {
    const [documents, setDocuments] = useState<CustomDocument[]>([]);

    useEffect(() => {
        setDocuments(customDocuments);
    }, [customDocuments]);

    useEffect(() => {
        const addDoc = (e: CustomEventInit<CustomDocument[]>) => {
            (e.detail || []).forEach((doc) => addCustomDocument(doc));
        };
        window.addEventListener(CUSTOM_DOCUMENT_EVENT.customDocumentAdded, addDoc);
        return () => {
            window.removeEventListener(CUSTOM_DOCUMENT_EVENT.customDocumentAdded, addDoc);
        };
    }, []);

    const onSearch = (value: string) => {
        if (customDocuments.length) {
            setDocuments(
                customDocuments.filter((d) => simpleRegExp(value).test(strNormalize(d.title))),
            );
        }
    };

    const ipcRequestWithLoader = useIpcRequestWithLoader();

    const handleDeletion = (document: CustomDocument) => {
        ipcRequestWithLoader(async () => {
            await window.api.app.deleteCustomDocument(document.id);
            removeCustomDocument(document.id);
            window.dispatchEvent(
                new CustomEvent<CustomDocument>(CUSTOM_DOCUMENT_EVENT.customDocumentRemoved, {
                    detail: document,
                }),
            );
        });
    };

    return (
        <>
            <div className="flex flex-center">
                <DocumentTitle length={documents.length} />
            </div>

            <div className="flex flex-center mt-2 mb-2">
                <Space direction="horizontal">
                    <Input.Search onSearch={onSearch} />
                </Space>
            </div>

            <div style={{ overflow: 'auto', maxHeight: '300px' }}>
                <List
                    itemLayout="horizontal"
                    dataSource={documents}
                    renderItem={(document) => (
                        <List.Item
                            actions={[
                                <DocumentViewer
                                    key="view"
                                    onItemClick={() => handleCancel()}
                                    name={document.title}
                                    id={document.documentId}
                                >
                                    <Button shape="circle" icon={<EyeOutlined />} />
                                </DocumentViewer>,
                                <DeleteBtn key="delete" confirm={() => handleDeletion(document)} />,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<FileAddOutlined />}
                                title={<span>{document.title}</span>}
                            />
                        </List.Item>
                    )}
                />
            </div>
        </>
    );
}

function validateFile(file: File, showMessage: boolean = true) {
    const isJpgOrPng = file.type === 'application/pdf';
    if (!isJpgOrPng) {
        if (showMessage) message.error(`seul le format pdf est pris en charge.`);
    }
    const isLt8k = file.size / 1024 / 1024 <= 0.8;
    if (!isLt8k) {
        if (showMessage) message.error('Le fichier doit être inférieur ou égal à 2Mo !');
    }
    return isJpgOrPng && isLt8k;
}

type UploadFilePath = UploadFile & { path?: string };

function Uploader() {
    const [fileList, setFileList] = useState<UploadFilePath[]>([]);
    const [uploading, setUploading] = useState<boolean>(false);

    const uploadElRef = useRef<HTMLDivElement | null>(null);

    const [uploadProgress, setUploadProgress] = useState<
        CustomDocumentUploadProgress | undefined
    >();

    const sermons = useSermonStore((s) => s.sermons);

    const props: DraggerProps = {
        name: 'file',
        multiple: true,
        accept: 'application/pdf',
        type: 'select',
        onRemove: (file) => {
            setFileList((fileList) => {
                const index = fileList.indexOf(file);
                const newFileList = fileList.slice();
                newFileList.splice(index, 1);
                return newFileList;
            });
        },
        beforeUpload: (file) => {
            if (!validateFile(file, false) || fileList.length >= 10 || !file.name.endsWith('.pdf'))
                return false;

            setFileList((fileList) => {
                if (fileList.some((f) => f.name === file.name)) {
                    return fileList;
                } else {
                    return [...fileList, file];
                }
            });
            return false;
        },
        fileList,
    };

    async function handleUpload() {
        if (fileList.length === 0) return;

        const titlesList = sermons.map((d) => `${d.title}.pdf`);

        for (const file of fileList) {
            if (titlesList.includes(file.name)) {
                message.error(`Le document avec nom '${file.name}' existe d\u00e9j\u00e0`);
                return false;
            }
        }

        setUploading(true);

        const paths: UploadDocument[] = fileList
            .map((d) => ({
                name: d.name,
                path: d.path!,
            }))
            .filter((d) => d.path);

        window.api.app
            .uploadCustomDocuments(paths)
            .then((_docs) => {
                const docs = _docs as CustomDocument[];
                if (docs.length > 0) {
                    message.success(`T\u00e9l\u00e9chargement termin\u00e9`);
                    setFileList((files) => {
                        return files.filter((f) => !docs.some((b) => f.name.includes(b.title)));
                    });
                }
            })
            .finally(() => setUploading(false));
        return;
    }

    // handle all commit uploaded document and error
    useEffect(() => {
        const cleanup = window.api.on.customDocumentUploadedFile((doc) => {
            window.dispatchEvent(
                new CustomEvent<CustomDocument[]>(CUSTOM_DOCUMENT_EVENT.customDocumentAdded, {
                    detail: [doc as CustomDocument],
                }),
            );
        });
        return cleanup;
    }, []);

    useEffect(() => {
        // upload progress handler
        const cleanup = window.api.on.customDocumentUploadProgress((data) => {
            const progressData = data as CustomDocumentUploadProgress;
            if (progressData.type === 'progress') {
                setUploadProgress(progressData);
            } else {
                window.setTimeout(() => {
                    setUploadProgress(undefined);
                }, 2000);
            }
        });
        return cleanup;
    }, []);

    // catch error on uploading document progress, specially when there's no connection
    useEffect(() => {
        const cleanup = window.api.on.customDocumentConnectionRequired(() =>
            message.warning('Vous devez être connecté à Internet pour télécharger le document'),
        );
        return cleanup;
    }, []);

    // scroll to bottom container when new file added
    useEffect(() => {
        if (fileList.length > 0) {
            window.setTimeout(() => {
                if (uploadElRef.current) {
                    uploadElRef.current.scrollTo({
                        behavior: 'smooth',
                        top: uploadElRef.current.scrollHeight,
                    });
                }
            }, 500);
        }
    }, [fileList]);

    return (
        <>
            <div className="flex flex-center mb-2">
                <Typography.Text type="secondary">Nouveaux Documents</Typography.Text>
            </div>

            <div
                ref={uploadElRef}
                style={{
                    overflow: 'auto',
                    maxHeight: '400px',
                    padding: '0 10px',
                    marginBottom: '10px',
                }}
            >
                <div className="flex flex-center mb-2">
                    <Dragger {...props}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <div style={{ padding: '0 9px' }}>
                            <p className="ant-upload-text">
                                Cliquez et d\u00e9poser les fichiers dans cette zone pour
                                T\u00e9l\u00e9charger
                            </p>
                            <p className="ant-upload-hint">
                                Seuls les fichiers PDF sont pris en charge (taille maximale 800KB)
                                <br />
                                Vous ne pouvez envoyer que 10 fichiers par t\u00e9l\u00e9chargement
                            </p>
                        </div>
                    </Dragger>
                </div>
            </div>
            <div className="flex flex-center">
                {uploading && uploadProgress?.type === 'progress' ? (
                    <Space direction="vertical">
                        <Space direction="horizontal">
                            <span>T\u00e9l\u00e9chargement</span>
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
                        </Space>
                        <div style={{ width: 170 }}>
                            <Progress
                                percent={parseInt(
                                    (
                                        (uploadProgress.progress * 100) /
                                        uploadProgress.total
                                    ).toFixed(2),
                                    10,
                                )}
                                size="small"
                            />
                        </div>
                    </Space>
                ) : (
                    <Button
                        type="primary"
                        onClick={handleUpload}
                        disabled={fileList.length === 0}
                        loading={uploading}
                        style={{ margin: '0 10px' }}
                    >
                        {uploading ? 'T\u00e9l\u00e9chargement' : 'T\u00e9l\u00e9charger'}
                    </Button>
                )}
            </div>
        </>
    );
}
