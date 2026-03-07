import { useEffect, useRef, useState } from 'react';
import { Button, Col, Divider, Input, Modal, Row, Space, Typography, message, Spin } from 'antd';
import type { CustomDocument } from '@shared/types';
import { FileAddOutlined, EyeOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import { DeleteBtn } from '@renderer/components/delete-btn';

import { useModalVisible, useIpcRequestWithLoader, useOpenCustomDocument } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useAppStore, useCustomDocumentsStore, useSermonStore } from '@renderer/stores';

export default function CustomDocuments() {
    const { visible, show, hide } = useModalVisible();

    const sermons = useSermonStore((s) => s.sermons);

    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);
    const addCustomDocument = useCustomDocumentsStore((s) => s.addCustomDocument);
    const removeCustomDocument = useCustomDocumentsStore((s) => s.removeCustomDocument);

    useEffect(() => {
        window.api.app.getCustomDocuments().then((datas) => {
            setCustomDocuments(datas);
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
                        <Space orientation="horizontal">
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
                open={visible}
                footer={null}
                onOk={hide}
                onCancel={hide}
            >
                <Row>
                    <Col span={11}>
                        <CustomDocumentItem
                            customDocuments={customDocuments}
                            removeCustomDocument={removeCustomDocument}
                            handleCancel={hide}
                        />
                    </Col>
                    <Col span={2}>
                        <Divider style={{ minHeight: '250px' }} orientation="vertical" />
                    </Col>
                    <Col span={11}>
                        <UploadForm
                            customDocuments={customDocuments}
                            addCustomDocument={addCustomDocument}
                        />
                    </Col>
                </Row>
            </Modal>
        </>
    );
}

const DocumentTitle = ({ length }: { length: number }) => {
    const appLoaded = useAppStore((s) => s.loaded);

    return (
        <Space orientation="horizontal">
            <Typography.Text type="secondary">Documents ajoutés ({length})</Typography.Text>
            {!appLoaded && <Spin indicator={<LoadingOutlined spin />} />}
        </Space>
    );
};

function CustomDocumentItem({
    handleCancel,
    customDocuments,
    removeCustomDocument,
}: {
    handleCancel: () => void;
    customDocuments: CustomDocument[];
    removeCustomDocument: (id: string) => void;
}) {
    const openCustomDocument = useOpenCustomDocument();
    const [documents, setDocuments] = useState<CustomDocument[]>([]);

    useEffect(() => {
        setDocuments(customDocuments);
    }, [customDocuments]);

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
            message.success('Document supprimé');
        });
    };

    return (
        <>
            <div className="flex flex-center">
                <DocumentTitle length={documents.length} />
            </div>

            <div className="flex flex-center mt-2 mb-2">
                <Space orientation="horizontal">
                    <Input.Search onSearch={onSearch} />
                </Space>
            </div>

            <div style={{ overflow: 'auto', maxHeight: '300px' }}>
                {documents.map((document) => (
                    <div
                        key={document.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid var(--ant-color-border)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flex: 1,
                                minWidth: 0,
                            }}
                        >
                            <FileAddOutlined />
                            <span
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {document.title}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <Button
                                shape="circle"
                                icon={<EyeOutlined />}
                                onClick={() => {
                                    openCustomDocument(document.title, document.sermonId);
                                    handleCancel();
                                }}
                            />
                            <DeleteBtn confirm={() => handleDeletion(document)} />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function UploadForm({
    customDocuments,
    addCustomDocument,
}: {
    customDocuments: CustomDocument[];
    addCustomDocument: (doc: CustomDocument) => void;
}) {
    const [name, setName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const nameExists = customDocuments.some(
        (d) => d.title.toLowerCase() === name.trim().toLowerCase(),
    );

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            message.error('Seul le format PDF est pris en charge.');
            return;
        }
        setSelectedFile(file);
        if (!name.trim()) {
            setName(file.name.replace(/\.pdf$/i, ''));
        }
    };

    const handleUpload = async () => {
        const trimmedName = name.trim();
        if (!trimmedName || !selectedFile) return;
        if (nameExists) {
            message.error('Un document avec ce nom existe déjà.');
            return;
        }

        setUploading(true);
        try {
            const buffer = await selectedFile.arrayBuffer();
            const pdfBytes = new Uint8Array(buffer);
            const doc = await window.api.app.createCustomDocument(trimmedName, pdfBytes);
            addCustomDocument(doc);
            message.success('Document ajouté');
            setName('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch {
            message.error("Erreur lors de l'extraction du document.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <div className="flex flex-center mb-2">
                <Typography.Text type="secondary">Nouveau Document</Typography.Text>
            </div>

            <div style={{ padding: '0 10px' }}>
                <div className="mb-2">
                    <Typography.Text>Nom</Typography.Text>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom du document"
                        status={nameExists ? 'error' : undefined}
                    />
                    {nameExists && (
                        <Typography.Text type="danger" style={{ fontSize: '0.85em' }}>
                            Ce nom existe déjà
                        </Typography.Text>
                    )}
                </div>

                <div className="mb-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <Button icon={<UploadOutlined />} onClick={handleFileSelect}>
                        {selectedFile ? selectedFile.name : 'Choisir un fichier PDF'}
                    </Button>
                </div>

                <div className="flex flex-center">
                    <Button
                        type="primary"
                        onClick={handleUpload}
                        disabled={!name.trim() || !selectedFile || nameExists}
                        loading={uploading}
                    >
                        {uploading ? 'Traitement...' : 'Ajouter'}
                    </Button>
                </div>
            </div>
        </>
    );
}
