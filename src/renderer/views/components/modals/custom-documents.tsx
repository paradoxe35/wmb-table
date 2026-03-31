import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Select, Space, Typography, message, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CustomDocument, InstalledLanguage } from '@shared/types';
import {
    EyeOutlined,
    FileTextOutlined,
    LoadingOutlined,
    PlusOutlined,
    UploadOutlined,
} from '@ant-design/icons';

import { useModalVisible, useIpcRequestWithLoader, useOpenCustomDocument } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useAppStore, useCustomDocumentsStore } from '@renderer/stores';
import { DeleteBtn } from '@renderer/components/delete-btn';

export default function CustomDocuments() {
    const { t } = useTranslation();
    const { visible, show, hide } = useModalVisible();
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguage[]>([]);

    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);
    const addCustomDocument = useCustomDocumentsStore((s) => s.addCustomDocument);
    const removeCustomDocument = useCustomDocumentsStore((s) => s.removeCustomDocument);

    useEffect(() => {
        window.api.app
            .getCustomDocuments()
            .then((docs) => {
                setCustomDocuments(docs);
            })
            .catch(() => {
                message.error(t('Erreur lors du chargement des documents'));
            });
        window.api.languages
            .getInstalled()
            .then(setInstalledLanguages)
            .catch(() => {});
    }, []);

    useEffect(() => {
        const cleanup = window.api.on.openModalDocumentFromMain(show);
        return cleanup;
    }, []);

    useEffect(() => {
        window.addEventListener(CUSTOM_DOCUMENT_EVENT.openModal, show);
        return () => window.removeEventListener(CUSTOM_DOCUMENT_EVENT.openModal, show);
    }, [show]);

    const handleClose = () => {
        hide();
        setShowUploadForm(false);
    };

    const handleDocumentAdded = (doc: CustomDocument) => {
        addCustomDocument(doc);
        setShowUploadForm(false);
    };

    return (
        <Modal
            width={480}
            title={<ModalTitle count={customDocuments.length} />}
            open={visible}
            footer={null}
            onCancel={handleClose}
        >
            {showUploadForm ? (
                <UploadForm
                    customDocuments={customDocuments}
                    installedLanguages={installedLanguages}
                    onAdded={handleDocumentAdded}
                    onCancel={() => setShowUploadForm(false)}
                />
            ) : (
                <DocumentList
                    customDocuments={customDocuments}
                    installedLanguages={installedLanguages}
                    removeCustomDocument={removeCustomDocument}
                    onClose={handleClose}
                    onAdd={() => setShowUploadForm(true)}
                />
            )}
        </Modal>
    );
}

const ModalTitle = ({ count }: { count: number }) => {
    const { t } = useTranslation();
    const appLoaded = useAppStore((s) => s.loaded);

    return (
        <Space>
            <span>{t('Documents ajoutés')}</span>
            <Typography.Text type="secondary">({count})</Typography.Text>
            {!appLoaded && <Spin indicator={<LoadingOutlined spin />} size="small" />}
        </Space>
    );
};

function DocumentList({
    customDocuments,
    installedLanguages,
    removeCustomDocument,
    onClose,
    onAdd,
}: {
    customDocuments: CustomDocument[];
    installedLanguages: InstalledLanguage[];
    removeCustomDocument: (id: string) => void;
    onClose: () => void;
    onAdd: () => void;
}) {
    const { t } = useTranslation();
    const openCustomDocument = useOpenCustomDocument();
    const [searchTerm, setSearchTerm] = useState('');
    const ipcRequestWithLoader = useIpcRequestWithLoader();
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);

    const filtered = searchTerm
        ? customDocuments.filter((d) => simpleRegExp(searchTerm).test(strNormalize(d.title)))
        : customDocuments;

    const handleDeletion = (document: CustomDocument) => {
        ipcRequestWithLoader(async () => {
            await window.api.app.deleteCustomDocument(document.id);
            removeCustomDocument(document.id);
            window.dispatchEvent(
                new CustomEvent<CustomDocument>(CUSTOM_DOCUMENT_EVENT.customDocumentRemoved, {
                    detail: document,
                }),
            );
            message.success(t('Document supprimé'));
        });
    };

    const handleLanguageChange = async (doc: CustomDocument, languageCode: string) => {
        await window.api.app.updateCustomDocumentLanguage(doc.id, languageCode);
        setCustomDocuments(
            customDocuments.map((d) => (d.id === doc.id ? { ...d, languageCode } : d)),
        );
        message.success(t('Langue modifiée'));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <Input.Search
                    placeholder={t('Rechercher...')}
                    allowClear
                    onSearch={setSearchTerm}
                    onChange={(e) => !e.target.value && setSearchTerm('')}
                    style={{ flex: 1 }}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                    {t('Ajouter')}
                </Button>
            </div>

            <div style={{ overflow: 'auto', maxHeight: 350 }}>
                {filtered.length === 0 && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '2rem 0',
                            gap: 8,
                        }}
                    >
                        <FileTextOutlined style={{ fontSize: 'var(--fs-7xl)', opacity: 0.25 }} />
                        <Typography.Text type="secondary">
                            {customDocuments.length === 0
                                ? t('Aucun document ajouté')
                                : t('Aucun résultat')}
                        </Typography.Text>
                    </div>
                )}

                {filtered.map((doc) => (
                    <DocumentItem
                        key={doc.id}
                        document={doc}
                        installedLanguages={installedLanguages}
                        onView={() => {
                            openCustomDocument(doc.title, doc.sermonId);
                            onClose();
                        }}
                        onDelete={() => handleDeletion(doc)}
                        onLanguageChange={(lang) => handleLanguageChange(doc, lang)}
                    />
                ))}
            </div>
        </div>
    );
}

const DocumentItem = React.memo<{
    document: CustomDocument;
    installedLanguages: InstalledLanguage[];
    onView: () => void;
    onDelete: () => void;
    onLanguageChange: (languageCode: string) => void;
}>(({ document, installedLanguages, onView, onDelete, onLanguageChange }) => {
    const langLabel =
        installedLanguages.find((l) => l.code === document.languageCode)?.language ||
        document.languageCode;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 4px',
                borderBottom:
                    '1px solid var(--ant-color-border-secondary, var(--ant-color-border))',
                gap: 10,
            }}
        >
            <FileTextOutlined style={{ fontSize: 'var(--fs-xl)', opacity: 0.45, flexShrink: 0 }} />
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
                title={document.title}
            >
                {document.title}
            </div>
            <Select
                size="small"
                variant="borderless"
                value={document.languageCode || undefined}
                placeholder="—"
                onChange={onLanguageChange}
                style={{ minWidth: 60, maxWidth: 100 }}
                options={installedLanguages.map((l) => ({
                    label: l.language,
                    value: l.code,
                }))}
                popupMatchSelectWidth={false}
            />
            <Space size={4} style={{ flexShrink: 0 }}>
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={onView} />
                <DeleteBtn confirm={onDelete} />
            </Space>
        </div>
    );
});
DocumentItem.displayName = 'DocumentItem';

function UploadForm({
    customDocuments,
    installedLanguages,
    onAdded,
    onCancel,
}: {
    customDocuments: CustomDocument[];
    installedLanguages: InstalledLanguage[];
    onAdded: (doc: CustomDocument) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [name, setName] = useState('');
    const [languageCode, setLanguageCode] = useState(contentLanguage ?? 'fr');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const nameExists = customDocuments.some(
        (d) => d.title.toLowerCase() === name.trim().toLowerCase(),
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            message.error(t('Seul le format PDF est pris en charge.'));
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
            message.error(t('Un document avec ce nom existe déjà.'));
            return;
        }

        setUploading(true);
        try {
            const buffer = await selectedFile.arrayBuffer();
            const pdfBytes = new Uint8Array(buffer);
            const doc = await window.api.app.createCustomDocument(
                trimmedName,
                pdfBytes,
                languageCode,
            );
            onAdded(doc);
            message.success(t('Document ajouté'));
        } catch {
            message.error(t("Erreur lors de l'extraction du document."));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <Typography.Text
                    strong
                    style={{ fontSize: 'var(--fs-rel-xl)', display: 'block', marginBottom: 4 }}
                >
                    {t('Nom du document')}
                </Typography.Text>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('Nom du document')}
                    status={nameExists ? 'error' : undefined}
                />
                {nameExists && (
                    <Typography.Text type="danger" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                        {t('Ce nom existe déjà')}
                    </Typography.Text>
                )}
            </div>

            <div>
                <Typography.Text
                    strong
                    style={{ fontSize: 'var(--fs-rel-xl)', display: 'block', marginBottom: 4 }}
                >
                    {t('Langue du document')}
                </Typography.Text>
                <Select
                    style={{ width: '100%' }}
                    value={languageCode}
                    showSearch
                    optionFilterProp="label"
                    onChange={setLanguageCode}
                    options={installedLanguages.map((l) => ({
                        label: l.language,
                        value: l.code,
                    }))}
                />
            </div>

            <div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <Button
                    icon={<UploadOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                    block
                    style={{ textAlign: 'left' }}
                >
                    {selectedFile ? selectedFile.name : t('Choisir un fichier PDF')}
                </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={onCancel} disabled={uploading}>
                    {t('Retour')}
                </Button>
                <Button
                    type="primary"
                    onClick={handleUpload}
                    disabled={!name.trim() || !selectedFile || nameExists}
                    loading={uploading}
                >
                    {uploading ? t('Traitement...') : t('Ajouter')}
                </Button>
            </div>
        </div>
    );
}
