import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App as AntApp, Button, Input, Space, Tooltip, message } from 'antd';
import {
    LeftOutlined,
    FilePdfOutlined,
    EditOutlined,
    ReadOutlined,
    ExclamationCircleOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import type { Editor } from '@tiptap/react';

import type { UiLanguage } from '@shared/constants';
import type { NoteItem } from '@shared/types';
import { useIpcRequestWithLoader, useValueStateRef } from '@renderer/hooks';
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

    const onSave = () => {
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
    };

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
                    <Input
                        autoFocus={true}
                        size="large"
                        defaultValue={workingNote.current?.name}
                        minLength={3}
                        allowClear
                        onKeyUp={(e) => (searchValue.current = e.currentTarget.value)}
                        placeholder={t('Nom sujet')}
                    />
                </form>
            ),
        });
    }, [modal]);

    return openModal;
};

function ButtonsControllers({
    backToNotes,
    workingNote,
    editorRef,
    hasContent,
    importingDocument,
    onImportDocument,
}: {
    backToNotes: () => void;
    workingNote: NoteItem | null;
    editorRef: React.RefObject<Editor | null>;
    hasContent: boolean;
    importingDocument: boolean;
    onImportDocument: (file: File) => Promise<void>;
}) {
    const { t } = useTranslation();
    const openModal = useRenameNote(workingNote);
    const workingNoteRef = useValueStateRef(workingNote);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [readOnly, setReadOnly] = useState(false);

    const exportPdf = () => {
        const editor = editorRef.current;
        if (!editor || !hasMeaningfulHtmlContent(editor.getHTML())) {
            return;
        }
        setLoadingPdf(true);
        window.api.notes
            .exportPdf(workingNoteRef.current?.id ?? '')
            .then((result) => {
                if (result.status === 'success') {
                    message.success(t('Enregistré'));
                }
            })
            .finally(() => setLoadingPdf(false));
    };

    useEffect(() => {
        window.addEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        return () => {
            window.removeEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        };
    }, [openModal]);

    const readOnlyMode = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const next = !readOnly;
        setReadOnly(next);
        editor.setEditable(!next);
    };

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
        const editor = editorRef.current;
        if (editor && !hasMeaningfulHtmlContent(editor.getHTML())) {
            return confirm();
        }
        backToNotes();
    }, [backToNotes, confirm, editorRef]);

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
                    <a onClick={openModal}>
                        <Tooltip title={t('Renommer')}>
                            <EditOutlined />
                        </Tooltip>
                    </a>
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
                                onClick={readOnlyMode}
                                type={readOnly ? 'primary' : 'dashed'}
                                icon={<ReadOutlined />}
                            />
                        </Tooltip>
                        <Tooltip title={t('Exporter au format PDF')}>
                            <Button
                                type="dashed"
                                onClick={exportPdf}
                                loading={loadingPdf}
                                icon={<FilePdfOutlined />}
                            />
                        </Tooltip>
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
    const editorRef = useRef<Editor | null>(null);
    const renameTimerRef = useRef<number | null>(null);

    const [workingNote, setWorkingNote] = useState<NoteItem | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [importingDocument, setImportingDocument] = useState(false);

    const bibleReferenceModal = useBibleReferenceModal();
    const ipcRequestWithLoader = useIpcRequestWithLoader();

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

    const handleEditorReady = useCallback((editor: Editor) => {
        editorRef.current = editor;
    }, []);

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

                const editor = editorRef.current;
                if (editor && editor.getHTML() !== (importedNote.content ?? '')) {
                    editor.commands.setContent(importedNote.content ?? '', { emitUpdate: false });
                }

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
        [clearRenameTimer, t, workingNoteIdRef],
    );

    const firstSync = useRef(false);
    useEffect(() => {
        if (workingNote && !firstSync.current) {
            void syncAvailableReferencesFromHtml(workingNote.content || '');
            firstSync.current = true;
        }
    }, [workingNote, syncAvailableReferencesFromHtml]);

    // Suppress unused-warning while preserving the request hook for parity with the legacy module.
    void ipcRequestWithLoader;

    return (
        <div className="editor-layout">
            <ButtonsControllers
                editorRef={editorRef}
                workingNote={workingNote}
                backToNotes={backToNotes}
                hasContent={hasContent}
                importingDocument={importingDocument}
                onImportDocument={handleImportDocument}
            />
            <TiptapEditorView
                workingNoteId={workingNoteId}
                initialContent={workingNote?.content ?? null}
                uiLanguage={uiLanguage}
                onChange={handleEditorChange}
                onContentPresenceChange={setHasContent}
                onReady={handleEditorReady}
                bibleReferenceModal={bibleReferenceModal}
            />
            <ReferenceBibleModal {...bibleReferenceModal} />
        </div>
    );
}
