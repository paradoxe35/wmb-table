import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App as AntApp, Button, Dropdown, Space, Spin, Tooltip, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    LeftOutlined,
    ExportOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    EditOutlined,
    ReadOutlined,
    ExclamationCircleOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import type { PdfExportResult } from '@shared/ipc.types';

import type { UiLanguage } from '@shared/constants';
import type { NoteItem } from '@shared/types';
import { useValueStateRef } from '@renderer/hooks';
import { AutoFocusInput } from '@renderer/components/auto-focus-input';
import { hasMeaningfulHtmlContent } from '@shared/html-content';
import { EDITOR_EVENT, type RenameNoteDetail } from '@renderer/utils/events';
import {
    referenceBibleBrandLink,
    referenceBrandLink as referenceDocumentBrandLink,
    ReferenceBibleModal,
    useBibleReferenceModal,
} from '../references';

import { TiptapEditorView } from './editor-view';

const NOTE_IMPORT_ACCEPTED_TYPES = '.pdf,.txt,.md,.markdown,.docx,.epub';

function isSupportedNoteImport(file: File): boolean {
    return /\.(pdf|txt|md|markdown|docx|epub)$/i.test(file.name);
}

const useRenameNote = (note: NoteItem | null) => {
    const { t } = useTranslation();
    const searchValue = useValueStateRef<string>(note?.name || '');
    const workingNote = useValueStateRef<NoteItem | null>(note);
    const { modal } = AntApp.useApp();

    const onSave = useCallback(() => {
        if (!workingNote.current) return;
        window.api.notes
            .rename(workingNote.current.id, searchValue.current.trim())
            .then((saved) => {
                if (typeof saved === 'boolean') {
                    message.error(t('Le nom entré est invalid'));
                } else {
                    const detail: RenameNoteDetail = { name: searchValue.current.trim() };
                    window.dispatchEvent(
                        new CustomEvent<RenameNoteDetail>(EDITOR_EVENT.renameNote, { detail }),
                    );
                    message.success(t('Modifié'));
                }
            });
    }, [searchValue, t, workingNote]);

    const openModal = useCallback(() => {
        const modalInstance = modal.info({
            closable: true,
            icon: null,
            onOk: onSave,
            okText: t('Enregistrer'),
            title: t('Renommer'),
            content: (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSave();
                        modalInstance.destroy();
                    }}
                >
                    <AutoFocusInput
                        size="large"
                        defaultValue={workingNote.current?.name}
                        minLength={3}
                        allowClear
                        onChange={(e) => (searchValue.current = e.currentTarget.value)}
                        placeholder={t('Nom sujet')}
                    />
                </form>
            ),
        });
    }, [modal, onSave, searchValue, t, workingNote]);

    return openModal;
};

function ButtonsControllers({
    backToNotes,
    workingNote,
    hasContent,
    importingDocument,
    editable,
    onEditableChange,
    onImportDocument,
}: {
    backToNotes: () => void;
    workingNote: NoteItem | null;
    hasContent: boolean;
    importingDocument: boolean;
    editable: boolean;
    onEditableChange: (editable: boolean) => void;
    onImportDocument: (file: File) => Promise<void>;
}) {
    const { t } = useTranslation();
    const openModal = useRenameNote(workingNote);
    const workingNoteRef = useValueStateRef(workingNote);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [exporting, setExporting] = useState(false);
    const readOnly = !editable;

    const runExport = useCallback(
        async (
            invoke: (id: string) => Promise<PdfExportResult>,
            errorMessage: string,
        ): Promise<void> => {
            if (!hasContent) return;
            setExporting(true);
            try {
                const result = await invoke(workingNoteRef.current?.id ?? '');
                if (result.status === 'success') {
                    message.success(t('Enregistré'));
                } else if (result.status === 'empty') {
                    message.warning(t("La note n'a pas de contenu à exporter"));
                }
            } catch {
                message.error(errorMessage);
            } finally {
                setExporting(false);
            }
        },
        [hasContent, t, workingNoteRef],
    );

    const exportMenu = useMemo<MenuProps>(
        () => ({
            items: [
                {
                    key: 'pdf',
                    icon: <FilePdfOutlined />,
                    label: t('Exporter au format PDF'),
                    onClick: () =>
                        void runExport(
                            window.api.notes.exportPdf,
                            t("Impossible d'exporter la note en PDF"),
                        ),
                },
                {
                    key: 'docx',
                    icon: <FileWordOutlined />,
                    label: t('Exporter au format DOCX'),
                    onClick: () =>
                        void runExport(
                            window.api.notes.exportDocx,
                            t("Impossible d'exporter la note en DOCX"),
                        ),
                },
            ],
        }),
        [runExport, t],
    );

    useEffect(() => {
        window.addEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        return () => {
            window.removeEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        };
    }, [openModal]);

    const { modal: antModal } = AntApp.useApp();

    const confirm = useCallback(() => {
        antModal.confirm({
            title: t('Alerte'),
            icon: <ExclamationCircleOutlined />,
            content: t(
                "Semble que votre note n'a pas de contenu, si vous continuez cette note sera inconsidérée et elle sera supprimée",
            ),
            okText: t('Continuer'),
            cancelText: t('Annuler'),
            onOk: async () => {
                if (workingNoteRef.current?.id) {
                    await window.api.notes.delete(workingNoteRef.current.id);
                }
                backToNotes();
            },
        });
    }, [antModal, backToNotes, t, workingNoteRef]);

    const onBackToNotes = useCallback(() => {
        if (workingNote && !hasContent) {
            return confirm();
        }
        backToNotes();
    }, [backToNotes, confirm, hasContent, workingNote]);

    const handleImportFileChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';

            if (!file) return;
            if (!isSupportedNoteImport(file)) {
                message.error(t('Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.'));
                return;
            }
            await onImportDocument(file);
        },
        [onImportDocument, t],
    );

    return (
        <div className="editor-toolbar">
            <Space orientation="horizontal">
                <Button type="dashed" onClick={onBackToNotes} icon={<LeftOutlined />}>
                    {t('Notes')}
                </Button>
            </Space>

            <Space orientation="horizontal">
                <span>{workingNote?.name}</span>
                {workingNote && (
                    <Tooltip title={t('Renommer')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            aria-label={t('Renommer')}
                            onClick={openModal}
                        />
                    </Tooltip>
                )}
            </Space>

            <Space orientation="horizontal">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={NOTE_IMPORT_ACCEPTED_TYPES}
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        void handleImportFileChange(event);
                    }}
                />
                {workingNote && !hasContent ? (
                    <Tooltip title={t('Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.')}>
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            loading={importingDocument}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {t('Importer un document')}
                        </Button>
                    </Tooltip>
                ) : (
                    <>
                        <Tooltip
                            title={
                                !readOnly
                                    ? t('Activer le mode lecture')
                                    : t('Désactiver le mode lecture')
                            }
                        >
                            <Button
                                onClick={() => onEditableChange(!editable)}
                                type={readOnly ? 'primary' : 'dashed'}
                                icon={<ReadOutlined />}
                            />
                        </Tooltip>
                        <Dropdown menu={exportMenu} trigger={['click']} disabled={!hasContent}>
                            <Tooltip title={t('Exporter')}>
                                <Button
                                    type="dashed"
                                    loading={exporting}
                                    icon={<ExportOutlined />}
                                    aria-label={t('Exporter')}
                                />
                            </Tooltip>
                        </Dropdown>
                    </>
                )}
            </Space>
        </div>
    );
}

export default function EditorContent({
    workingNoteId,
    backToNotes,
    uiLanguage,
}: {
    uiLanguage: UiLanguage;
    workingNoteId: string;
    backToNotes: () => void;
}) {
    const { t } = useTranslation();
    const workingNoteIdRef = useValueStateRef(workingNoteId);
    const renameTimerRef = useRef<number | null>(null);

    const [workingNote, setWorkingNote] = useState<NoteItem | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [importingDocument, setImportingDocument] = useState(false);
    const [editable, setEditable] = useState(true);

    // Bumped on initial load and on import — used as the editor's React key so the editor
    // remounts with fresh content (no imperative setContent dance, no hydration race).
    const [contentVersion, setContentVersion] = useState(0);

    const bibleReferenceModal = useBibleReferenceModal();

    const workingNoteRef = useValueStateRef(workingNote);
    const hasContentRef = useValueStateRef(hasContent);

    const clearRenameTimer = useCallback(() => {
        if (renameTimerRef.current != null) {
            window.clearTimeout(renameTimerRef.current);
            renameTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        clearRenameTimer();

        window.api.notes.getById(workingNoteId).then((note) => {
            if (cancelled) return;
            const noteHasContent = hasMeaningfulHtmlContent(note?.content);
            setWorkingNote(note);
            setHasContent(noteHasContent);
            setContentVersion((v) => v + 1);

            if (note?.created && note.defaultName && !noteHasContent) {
                renameTimerRef.current = window.setTimeout(() => {
                    const latestNote = workingNoteRef.current;
                    if (
                        !cancelled &&
                        latestNote?.created &&
                        latestNote.defaultName &&
                        !hasContentRef.current
                    ) {
                        window.dispatchEvent(new Event(EDITOR_EVENT.renameNoteModal));
                    }
                }, 1000);
            }
        });

        return () => {
            cancelled = true;
            clearRenameTimer();
        };
    }, [clearRenameTimer, hasContentRef, workingNoteId, workingNoteRef]);

    useEffect(() => {
        const renameUpdate = (e: CustomEventInit<RenameNoteDetail>) => {
            const detail = e.detail;
            if (!detail) return;
            setWorkingNote((n) => (n ? { ...n, name: detail.name } : n));
        };
        window.addEventListener(EDITOR_EVENT.renameNote, renameUpdate);
        return () => {
            window.removeEventListener(EDITOR_EVENT.renameNote, renameUpdate);
        };
    }, []);

    const referencesIds = useCallback((html: string, prefix: string): string[] => {
        const fragment = document.createRange().createContextualFragment(html);
        return Array.from(fragment.querySelectorAll('a[href]'))
            .map((link) => link.getAttribute('href') || '')
            .filter((href) => href.startsWith(prefix))
            .map((href) => href.slice(prefix.length));
    }, []);

    const syncAvailableReferencesFromHtml = useCallback(
        async (html: string) => {
            await Promise.all([
                window.api.notes.syncReferences(
                    workingNoteIdRef.current,
                    referencesIds(html, referenceDocumentBrandLink),
                ),
                window.api.notes.syncBibleReferences(
                    workingNoteIdRef.current,
                    referencesIds(html, referenceBibleBrandLink),
                ),
            ]);
        },
        [referencesIds, workingNoteIdRef],
    );

    const handleEditorChange = useCallback(
        async (html: string) => {
            await window.api.notes.updateContent(workingNoteIdRef.current, html);
            await syncAvailableReferencesFromHtml(html);
        },
        [syncAvailableReferencesFromHtml, workingNoteIdRef],
    );

    const handleImportDocument = useCallback(
        async (file: File) => {
            setImportingDocument(true);
            clearRenameTimer();

            try {
                const buffer = await file.arrayBuffer();
                const importedNote = await window.api.notes.importDocument(
                    workingNoteIdRef.current,
                    {
                        fileName: file.name,
                        mimeType: file.type || null,
                        bytes: new Uint8Array(buffer),
                    },
                );

                setWorkingNote(importedNote);
                setHasContent(hasMeaningfulHtmlContent(importedNote.content));
                await syncAvailableReferencesFromHtml(importedNote.content ?? '');
                // Force the editor to remount with the imported content.
                setContentVersion((v) => v + 1);

                message.success(t('Document importé dans la note'));
            } catch (error) {
                message.error(
                    error instanceof Error
                        ? t(error.message)
                        : t("Erreur lors de l'import du document."),
                );
            } finally {
                setImportingDocument(false);
            }
        },
        [clearRenameTimer, syncAvailableReferencesFromHtml, t, workingNoteIdRef],
    );

    // Sync references with the DB once when the note first loads, so removed
    // references in saved HTML are cleaned up before the user makes any edit.
    const firstSync = useRef(false);
    useEffect(() => {
        if (workingNote && !firstSync.current) {
            void syncAvailableReferencesFromHtml(workingNote.content || '');
            firstSync.current = true;
        }
    }, [workingNote, syncAvailableReferencesFromHtml]);

    return (
        <div className="editor-layout">
            <ButtonsControllers
                workingNote={workingNote}
                backToNotes={backToNotes}
                hasContent={hasContent}
                importingDocument={importingDocument}
                editable={editable}
                onEditableChange={setEditable}
                onImportDocument={handleImportDocument}
            />
            {workingNote ? (
                <TiptapEditorView
                    key={contentVersion}
                    workingNoteId={workingNoteId}
                    initialContent={workingNote.content ?? ''}
                    uiLanguage={uiLanguage}
                    editable={editable}
                    onChange={handleEditorChange}
                    onContentPresenceChange={setHasContent}
                    bibleReferenceModal={bibleReferenceModal}
                />
            ) : (
                <div className="editor-scroll">
                    <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                        <Spin />
                    </div>
                </div>
            )}
            <ReferenceBibleModal {...bibleReferenceModal} />
        </div>
    );
}
