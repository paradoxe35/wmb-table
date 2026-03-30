import React, { useCallback, useEffect, useRef, useState } from 'react';
// @ts-expect-error — no type declarations for CKEditor 5 React
import { CKEditor } from '@ckeditor/ckeditor5-react';
import { useTranslation } from 'react-i18next';

import { ContextMenu } from '@renderer/utils/context-menu';
import { App as AntApp, Button, Input, Space, Tooltip, message } from 'antd';
import {
    LeftOutlined,
    FilePdfOutlined,
    EditOutlined,
    ReadOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import { debounce, substrAfter } from '@renderer/utils/functions';
import { useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';
import { NoteItem, NoteItemReference, NoteItemReferenceBible } from '@shared/types';
import { useIpcRequestWithLoader, useValueStateRef } from '@renderer/hooks';
import {
    referenceBibleBrandLink,
    referenceBrandLink as referenceDocumentBrandLink,
    ReferenceBibleModal,
    useBibleReferenceModal,
    useShowReferenceDetail,
} from './references';
import { EDITOR_EVENT } from '@renderer/utils/events';

// CKEditor UMD bundle — side-effect import assigns to window.DecoupledDocumentEditor
import './ckeditor/ckeditor';

// @ts-expect-error — CKEditor UMD attaches to window
const DecoupledDocumentEditor: any = window.DecoupledDocumentEditor;

/** Dismiss CKEditor's link balloon toolbar by clearing the selection. */
function dismissEditorBalloon(editor: any): void {
    if (!editor) return;
    editor.model.change((writer: any) => {
        writer.setSelection(
            writer.createRange(writer.createPositionAt(editor.model.document.getRoot(), 0)),
        );
    });
    // Also blur the editable to ensure balloon hides
    editor.ui.getEditableElement()?.blur();
}

function styleProperty(color = 'var(--ant-color-bg-container)') {
    return {
        backgroundColor: color,
    };
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
                    window.dispatchEvent(
                        new CustomEvent<{ name: string }>(EDITOR_EVENT.renameNote, {
                            detail: { name: searchValue.current.trim() },
                        }),
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
}: {
    backToNotes: () => void;
    workingNote: NoteItem | null;
    editorRef: React.RefObject<any>;
}) {
    const { t } = useTranslation();
    const openModal = useRenameNote(workingNote);

    const workingNoteRef = useValueStateRef(workingNote);

    const [loadingPdf, setLoadingPdf] = useState(false);

    const [readOnly, setReadOnly] = useState(false);

    const exportPdf = () => {
        const editor = editorRef.current;
        if (!editor || !editor.getData().trim()) {
            return;
        }
        setLoadingPdf(true);

        window.api.notes
            .exportPdf(workingNoteRef.current?.id ?? '')
            .then(() => message.success(t('Enregistré')))
            .finally(() => setLoadingPdf(false));
    };

    useEffect(() => {
        window.addEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        return () => {
            window.removeEventListener(EDITOR_EVENT.renameNoteModal, openModal);
        };
    }, []);

    const readOnlyMode = () => {
        if (!editorRef.current) return;
        setReadOnly((r) => !r);
        editorRef.current.isReadOnly = !editorRef.current.isReadOnly;
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
    }, [backToNotes, antModal]);

    const onBackToNotes = useCallback(() => {
        const editor = editorRef.current;
        if (editor && (editor.getData() || '').trim().length < 1) {
            return confirm();
        }
        backToNotes();
    }, [confirm, backToNotes]);

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
                <Tooltip
                    title={
                        !readOnly ? t('Activer le mode lecture') : t('Désactiver le mode lecture')
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
            </Space>
        </div>
    );
}

export default function EditorContent({
    workingNoteId,
    backToNotes,
}: {
    workingNoteId: string;
    backToNotes: () => void;
}) {
    const { t } = useTranslation();
    const modalRefence = useShowReferenceDetail();
    const navigateWmbLink = useWmbLinkNavigate();

    const workingNoteIdRef = useValueStateRef(workingNoteId);

    const editorRef = useRef<any>(null);

    const contextEvent = useRef<MouseEvent | null>(null);

    const [workingNote, setWorkingNote] = useState<NoteItem | null>(null);

    const [ready, setReady] = useState(false);

    const bibleReferenceModal = useBibleReferenceModal();

    const ipcRequestWithLoader = useIpcRequestWithLoader();

    useEffect(() => {
        window.api.notes.getById(workingNoteId).then((note) => {
            setWorkingNote(note);
            if (note?.created && note.defaultName) {
                window.setTimeout(() => {
                    window.dispatchEvent(new Event(EDITOR_EVENT.renameNoteModal));
                }, 1000);
            }
        });
    }, [workingNoteId]);

    useEffect(() => {
        const renameUpdate = (e: CustomEventInit<{ name: string }>) => {
            if (!e.detail) return;
            setWorkingNote((n) => {
                if (!n) return n;
                const nn = { ...n };
                nn.name = e.detail?.name || '';
                return nn;
            });
        };
        window.addEventListener(EDITOR_EVENT.renameNote, renameUpdate);
        return () => {
            window.removeEventListener(EDITOR_EVENT.renameNote, renameUpdate);
        };
    }, []);

    const handleEditorLinksClick = useCallback((idRef: string) => {
        ipcRequestWithLoader<NoteItemReference | null>(async () => {
            return await window.api.notes.getReference(idRef);
        }).then((data) => {
            if (data) {
                modalRefence(data);
            } else {
                message.error(t('La référence est invalide'));
            }
        });
    }, []);

    const handleEditorLinksBibleClick = useCallback((idRef: string) => {
        ipcRequestWithLoader<NoteItemReferenceBible | null>(async () => {
            return await window.api.notes.getBibleReference(idRef);
        }).then((data) => {
            if (data) {
                bibleReferenceModal.showModal(data);
            } else {
                message.error(t('La référence biblique est invalide'));
            }
        });
    }, []);

    const navigateWmbLinkRef = useValueStateRef(navigateWmbLink);

    useEffect(() => {
        const editor = editorRef.current;
        const handleEditorLinks = (e: MouseEvent) => {
            let target = e.target as HTMLElement;
            // Walk up to find the <a> tag — CKEditor may wrap link text in nested elements
            while (target && target.tagName !== 'A' && target !== e.currentTarget) {
                target = target.parentElement as HTMLElement;
            }
            if (!target || target.tagName !== 'A') return;

            const href = target.getAttribute('href');
            if (!href) return;

            const wmbBrandLink = 'http://w.t/#wmb/';
            const isReference =
                href.startsWith(referenceDocumentBrandLink) ||
                href.startsWith(referenceBibleBrandLink) ||
                href.startsWith(wmbBrandLink) ||
                href.startsWith('wmb://');

            if (isReference) {
                e.preventDefault();
                e.stopPropagation();
                dismissEditorBalloon(editorRef.current);
            }

            if (href.startsWith(referenceDocumentBrandLink)) {
                handleEditorLinksClick(substrAfter(href, referenceDocumentBrandLink));
            } else if (href.startsWith(referenceBibleBrandLink)) {
                handleEditorLinksBibleClick(substrAfter(href, referenceBibleBrandLink));
            } else if (href.startsWith(wmbBrandLink)) {
                navigateWmbLinkRef.current('wmb://' + substrAfter(href, wmbBrandLink));
            } else if (href.startsWith('wmb://')) {
                navigateWmbLinkRef.current(href);
            }
        };
        if (editor) {
            const editorEl = editor.ui.getEditableElement() as HTMLElement;
            editorEl.addEventListener('click', handleEditorLinks);
            return () => {
                editorEl.removeEventListener('click', handleEditorLinks);
            };
        }
        return;
    }, [ready]);

    const deleteReference = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || !contextEvent.current?.target) return;

        let target = contextEvent.current.target as HTMLElement;
        if (target.tagName !== 'A') target = target.parentElement as HTMLElement;

        if (
            target?.tagName === 'A' &&
            target.getAttribute('href')?.startsWith(referenceDocumentBrandLink)
        ) {
            const href = target.getAttribute('href')!;
            const refId = substrAfter(href, referenceDocumentBrandLink);

            window.api.notes.deleteReference(refId).then(() => {
                // Map the DOM <a> to a CKEditor view element, then select it and unlink
                const viewElement = editor.editing.view.domConverter.mapDomToView(target);
                if (viewElement) {
                    // Find the attributeElement wrapping (the <a> in view)
                    const linkView = viewElement.is('attributeElement')
                        ? viewElement
                        : viewElement.parent?.is('attributeElement')
                          ? viewElement.parent
                          : null;

                    if (linkView) {
                        const modelRange = editor.editing.mapper.toModelRange(
                            editor.editing.view.createRangeOn(linkView),
                        );
                        editor.model.change((writer: any) => {
                            writer.setSelection(modelRange);
                        });
                        editor.execute('unlink');
                    }
                }
                message.success(t('Référence supprimée'));
            });
        } else {
            message.warning(t('Cliquez droit sur une référence pour la supprimer'));
        }
    }, []);

    const refereToDocument = useCallback(async (type: string) => {
        const editor = editorRef.current;
        if (contextEvent.current && contextEvent.current.target) {
            const target = contextEvent.current.target as HTMLElement;
            if (
                target.tagName === 'A' &&
                target.getAttribute('href')?.startsWith(referenceDocumentBrandLink)
            ) {
                return;
            }

            const selected = window.getSelection()?.toString().trim();

            if (selected && selected.length > 1) {
                switch (type) {
                    case 'document':
                        ipcRequestWithLoader<NoteItemReference>(async () => {
                            return await window.api.notes.createReference(
                                workingNoteIdRef.current,
                                selected,
                            );
                        }).then((ref) => {
                            editor.execute('link', referenceDocumentBrandLink + ref.id);
                            message.success(
                                t('Référence document: {{label}}', { label: ref.label }),
                            );
                        });
                        break;

                    case 'bible':
                        ipcRequestWithLoader<NoteItemReferenceBible>(async () => {
                            return await window.api.notes.createBibleReference(
                                workingNoteIdRef.current,
                                selected,
                            );
                        }).then((ref) => {
                            editor.execute('link', referenceBibleBrandLink + ref.id);
                            message.success(
                                t('Référence biblique: {{label}}', { label: ref.label }),
                            );
                            bibleReferenceModal.showModal(ref);
                        });
                        break;
                    default:
                        message.error(t('Aucune sélection trouvée pour la référence'));
                        break;
                }
            } else {
                message.error(t('Aucune sélection trouvée pour la référence'));
            }
        }
    }, []);

    const referencesIds = (fragment: DocumentFragment, type: string) => {
        return Array.from(fragment.querySelectorAll('a[href]'))
            .filter((link) => link.getAttribute('href')?.startsWith(type))
            .map((link) => {
                const str = link.getAttribute('href')!;
                const substr = type;
                return substrAfter(str, substr);
            });
    };

    const syncAvalaibleReferences = async (fragment: DocumentFragment) => {
        await window.api.notes.syncReferences(
            workingNoteIdRef.current,
            referencesIds(fragment, referenceDocumentBrandLink),
        );
        await window.api.notes.syncBibleReferences(
            workingNoteIdRef.current,
            referencesIds(fragment, referenceBibleBrandLink),
        );
    };

    const firstSync = useRef(false);

    useEffect(() => {
        if (workingNote && workingNote.content && !firstSync.current) {
            const fragment = document.createRange().createContextualFragment(workingNote.content);
            syncAvalaibleReferences(fragment);
            firstSync.current = true;
        }
    }, [workingNote]);

    const onChangeData = async () => {
        window.api.notes.updateContent(workingNoteId, editorRef.current.getData());
    };

    return (
        <div className="editor-layout">
            <ButtonsControllers
                editorRef={editorRef}
                workingNote={workingNote}
                backToNotes={backToNotes}
            />
            <Editor
                ready={ready}
                setReady={setReady}
                workingNoteId={workingNoteId}
                data={workingNote?.content || null}
                onChange={onChangeData}
                refereToDocument={refereToDocument}
                deleteReference={deleteReference}
                contextEvent={contextEvent}
                editorRef={editorRef}
            />

            <ReferenceBibleModal {...bibleReferenceModal} />
        </div>
    );
}

function Editor({
    data,
    workingNoteId,
    ready,
    setReady,
    refereToDocument,
    deleteReference,
    contextEvent,
    editorRef,
    onChange,
}: {
    data: string | null;
    workingNoteId: string;
    ready: boolean;
    refereToDocument: (type: string) => void;
    deleteReference: () => void;
    setReady: React.Dispatch<React.SetStateAction<boolean>>;
    onChange: () => void;
    contextEvent: React.RefObject<MouseEvent | null>;
    editorRef: React.RefObject<any>;
}) {
    const { t } = useTranslation();
    useEffect(() => {
        if (editorRef.current && editorRef.current.editor) {
            editorRef.current.editor.ui.view.toolbar.element.remove();
        }
    }, []);

    useEffect(() => {
        let chromeContextMenu: ContextMenu;

        const contextHandler = (e: MouseEvent) => {
            contextEvent.current = e;
        };

        if (editorRef.current) {
            chromeContextMenu = new ContextMenu(
                editorRef.current.ui.getEditableElement().parentElement,
                [
                    {
                        text: t('Référence document'),
                        onclick: () => refereToDocument('document'),
                    },
                    {
                        text: t('Référence biblique'),
                        onclick: () => refereToDocument('bible'),
                    },
                    null,
                    {
                        text: t('Supprimer la référence'),
                        onclick: () => deleteReference(),
                        color: 'var(--ant-color-error)',
                    },
                ],
            );

            chromeContextMenu.container.addEventListener('contextmenu', contextHandler);

            chromeContextMenu.install();
        }
        return () => {
            if (chromeContextMenu) {
                chromeContextMenu.uninstall();
                chromeContextMenu.container.removeEventListener('contextmenu', contextHandler);
            }
        };
    }, [ready]);
    return (
        <div className="editor-scroll">
            <div
                className="cke5-decoupled-custom-document-editable"
                style={{ ...styleProperty(), borderRadius: '5px' }}
            >
                <CKEditor
                    id={workingNoteId}
                    onReady={(editor: any) => {
                        editor.ui
                            .getEditableElement()
                            .parentElement.parentElement.parentElement.insertBefore(
                                editor.ui.view.toolbar.element,
                                editor.ui.getEditableElement().parentElement.parentElement,
                            );
                        editorRef.current = editor;
                        setReady(true);
                    }}
                    onError={({ willEditorRestart }: { willEditorRestart: any }) => {
                        if (willEditorRestart) {
                            editorRef.current.editor.ui.view.toolbar.element.remove();
                        }
                    }}
                    onChange={debounce(onChange, 1000)}
                    editor={DecoupledDocumentEditor}
                    data={data || ''}
                    config={{
                        toolbar: {
                            items: [
                                'heading',
                                '|',
                                'fontSize',
                                'fontFamily',
                                '|',
                                'pageBreak',
                                'fontColor',
                                'fontBackgroundColor',
                                '|',
                                'bold',
                                'italic',
                                'underline',
                                'strikethrough',
                                '|',
                                'alignment',
                                '|',
                                'numberedList',
                                'bulletedList',
                                '|',
                                'outdent',
                                'indent',
                                '|',
                                'todoList',
                                'link',
                                'blockQuote',
                                'insertTable',
                                '|',
                                'undo',
                                'redo',
                                'subscript',
                                'superscript',
                                'horizontalLine',
                                'textPartLanguage',
                            ],
                        },
                        link: {
                            addTargetToExternalLinks: true,
                            allowedProtocols: ['http', 'https', 'mailto', 'tel'],
                            decorators: [
                                {
                                    mode: 'automatic',
                                    callback: (url: string) =>
                                        typeof url === 'string' &&
                                        url.includes(referenceDocumentBrandLink),
                                    attributes: {
                                        title: t('Référence document'),
                                        reference: 'true',
                                        onclick: 'event.preventDefault()',
                                    },
                                },
                                {
                                    mode: 'automatic',
                                    callback: (url: string) =>
                                        typeof url === 'string' &&
                                        url.includes(referenceBibleBrandLink),
                                    attributes: {
                                        title: t('Référence biblique'),
                                        reference: 'true',
                                        bible: 'true',
                                        onclick: 'event.preventDefault()',
                                    },
                                },
                                {
                                    mode: 'automatic',
                                    callback: (url: string) =>
                                        typeof url === 'string' &&
                                        url.startsWith('http://w.t/#wmb/'),
                                    attributes: {
                                        title: t('Référence'),
                                        reference: 'true',
                                        onclick: 'event.preventDefault()',
                                    },
                                },
                            ],
                        },
                        language: {
                            ui: 'fr',
                            content: 'fr',
                            textPartLanguage: [
                                { title: t('Français'), languageCode: 'fr' },
                                { title: t('English'), languageCode: 'en' },
                            ],
                        },
                    }}
                />
            </div>
        </div>
    );
}
