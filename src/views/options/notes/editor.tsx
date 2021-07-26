import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContainerScrollY from '../../../components/container-scroll-y';
//@ts-ignore
import { CKEditor } from '@ckeditor/ckeditor5-react';

import { ContextMenu } from '../../../../modules/context-menu/context';
import { Button, Input, Modal, Space, Tooltip, message } from 'antd';
import {
  LeftOutlined,
  FilePdfOutlined,
  EditOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { debounce, substrAfter } from '../../../utils/functions';
import {
  NoteItem,
  NoteItemReference,
  NoteItemReferenceBible,
} from '../../../types';
import sendIpcRequest from '../../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../../utils/ipc-events';
import { useValueStateRef } from '../../../utils/hooks';
import {
  referenceBibleBrandLink,
  referenceBrandLink as referenceDocumentBrandLink,
  ReferenceBibleModal,
  useBibleReferenceModal,
  useShowReferenceDetail,
} from './references';

//@ts-ignore
let DecoupledDocumentEditor: any;

if (process.env.NODE_ENV === 'development') {
  require('./ckeditor/ckeditor');
  //@ts-ignore
  DecoupledDocumentEditor = window.DecoupledDocumentEditor;
} else {
  DecoupledDocumentEditor = require('./ckeditor/ckeditor');
}

function styleProperty(color = '#fff') {
  return {
    backgroundColor: color,
  };
}

const useRenameNote = (note: NoteItem | null) => {
  const searchValue = useValueStateRef<string>(note?.name || '');

  const workingNote = useValueStateRef<NoteItem | null>(note);

  const onSave = () => {
    if (!workingNote.current) return;
    sendIpcRequest<string | boolean>(
      IPC_EVENTS.notes_items_rename,
      workingNote.current._id,
      searchValue.current.trim()
    ).then((saved) => {
      if (typeof saved === 'boolean') {
        message.error('Le nom entré est invalid');
      } else {
        window.dispatchEvent(
          new CustomEvent<{ name: string }>('rename-note', {
            detail: { name: searchValue.current.trim() },
          })
        );
        message.success('Modifié');
      }
    });
  };

  const openModal = useCallback(() => {
    const modalInstance = Modal.info({
      closable: true,
      icon: null,
      onOk: onSave,
      okText: 'Enregistrer',
      title: 'Renommer',
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
            placeholder="Nom sujet"
          />
        </form>
      ),
    });
  }, []);

  return openModal;
};

function ButtonsControllers({
  backToNotes,
  workingNote,
  editorRef,
}: {
  backToNotes: () => void;
  workingNote: NoteItem | null;
  editorRef: React.MutableRefObject<any>;
}) {
  const openModal = useRenameNote(workingNote);

  const workingNoteRef = useValueStateRef(workingNote);

  const [loadingPdf, setLoadingPdf] = useState(false);

  const exportPdf = () => {
    const editor = editorRef.current;
    if (!editor || !editor.getData().trim()) {
      return;
    }
    setLoadingPdf(true);

    sendIpcRequest(
      IPC_EVENTS.notes_export_pdf,
      editor.getData(),
      workingNoteRef.current?.name
    ).finally(() => setLoadingPdf(false));
  };

  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    window.addEventListener('rename-note-modal', openModal);
    return () => {
      window.removeEventListener('rename-note-modal', openModal);
    };
  }, []);

  const readOnlyMode = () => {
    if (!editorRef.current) return;
    setReadOnly((r) => !r);
    editorRef.current.isReadOnly = !editorRef.current.isReadOnly;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        margin: '12px 0',
      }}
    >
      <Space direction="horizontal">
        <Button type="dashed" onClick={backToNotes} icon={<LeftOutlined />}>
          Notes
        </Button>
      </Space>

      <Space direction="horizontal">
        <span>{workingNote?.name}</span>
        {workingNote && (
          <a onClick={openModal}>
            <Tooltip title="Renommer">
              <EditOutlined />
            </Tooltip>
          </a>
        )}
      </Space>

      <Space direction="horizontal">
        <Tooltip title={`${!readOnly ? 'Activer' : 'Désactiver'} mode lecture`}>
          <Button
            onClick={readOnlyMode}
            type={readOnly ? 'primary' : 'dashed'}
            icon={<ReadOutlined />}
          />
        </Tooltip>
        <Tooltip title="Exporter au format PDF">
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
  const modalRefence = useShowReferenceDetail();

  const workingNoteIdRef = useValueStateRef(workingNoteId);

  const editorRef = useRef<any>(null);

  const contextEvent = useRef<MouseEvent | null>(null);

  const [workingNote, setWorkingNote] = useState<NoteItem | null>(null);

  const [ready, setReady] = useState(false);

  const workingNoteRef = useValueStateRef(workingNote);

  const bibleReferenceModal = useBibleReferenceModal();

  useEffect(() => {
    sendIpcRequest<NoteItem>(IPC_EVENTS.notes_items_get, workingNoteId).then(
      (note) => {
        setWorkingNote(note);
        note.created &&
          note.defaultName &&
          window.setTimeout(() => {
            window.dispatchEvent(new Event('rename-note-modal'));
          }, 1000);
      }
    );
  }, [workingNoteId]);

  useEffect(() => {
    const renameUpdate = (e: CustomEvent<{ name: string }>) => {
      setWorkingNote((n) => {
        if (!n) return n;
        const nn = { ...n };
        nn.name = e.detail.name;
        return nn;
      });
    };
    //@ts-ignore
    window.addEventListener('rename-note', renameUpdate);
    return () => {
      //@ts-ignore
      window.removeEventListener('rename-note', renameUpdate);
    };
  }, []);

  const handleEditorLinksClick = useCallback((idRef: string) => {
    sendIpcRequest<NoteItemReference | null>(
      IPC_EVENTS.notes_references_get,
      idRef
    ).then((data) => {
      if (data) {
        modalRefence(data, workingNoteRef.current as NoteItem);
      } else {
        message.error('La référence est invalide');
      }
    });
  }, []);

  const handleEditorLinksBibleClick = useCallback((idRef: string) => {
    sendIpcRequest<NoteItemReferenceBible | null>(
      IPC_EVENTS.notes_references_bible_get,
      idRef
    ).then((data) => {
      if (data) {
        bibleReferenceModal.showModal(data);
      } else {
        message.error('La référence biblique est invalide');
      }
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const handleEditorLinks = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      target =
        target.tagName === 'A' ? target : (target.parentElement as HTMLElement);

      if (
        target.tagName === 'A' &&
        target.getAttribute('href')?.startsWith(referenceDocumentBrandLink)
      ) {
        const str = target.getAttribute('href') as string;
        const substr = referenceDocumentBrandLink;
        handleEditorLinksClick(substrAfter(str, substr));
      } else if (
        target.tagName === 'A' &&
        target.getAttribute('href')?.startsWith(referenceBibleBrandLink)
      ) {
        const str = target.getAttribute('href') as string;
        const substr = referenceBibleBrandLink;
        handleEditorLinksBibleClick(substrAfter(str, substr));
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
            sendIpcRequest<NoteItemReference>(
              IPC_EVENTS.notes_references_store,
              workingNoteIdRef.current
            ).then((ref) => {
              editor.execute('link', referenceDocumentBrandLink + ref._id);
              message.success(`Référence document: ${ref.label}`);
            });
            break;

          case 'bible':
            sendIpcRequest<NoteItemReferenceBible>(
              IPC_EVENTS.notes_references_bible_store,
              workingNoteIdRef.current
            ).then((ref) => {
              editor.execute('link', referenceBibleBrandLink + ref._id);
              message.success(`Référence biblique: ${ref.label}`);
              bibleReferenceModal.showModal(ref);
            });
            break;
          default:
            message.error('Aucune sélection trouvée pour la référence');
            break;
        }
      } else {
        message.error('Aucune sélection trouvée pour la référence');
      }
    }
  }, []);

  const referencesIds = (fragment: DocumentFragment, type: string) => {
    return Array.from(fragment.querySelectorAll('a[href]'))
      .filter((link) => link.getAttribute('href')?.startsWith(type))
      .map((link) => {
        const str = link.getAttribute('href') as string;
        const substr = type;
        return substrAfter(str, substr);
      });
  };

  const syncAvalaibleReferences = async (fragment: DocumentFragment) => {
    await sendIpcRequest(
      IPC_EVENTS.notes_references_sync,
      workingNoteIdRef.current,
      referencesIds(fragment, referenceDocumentBrandLink)
    );
    await sendIpcRequest(
      IPC_EVENTS.notes_references_bible_sync,
      workingNoteIdRef.current,
      referencesIds(fragment, referenceBibleBrandLink)
    );
  };

  const firstSync = useRef(false);

  useEffect(() => {
    if (workingNote && workingNote.content && !firstSync.current) {
      const fragment = document
        .createRange()
        .createContextualFragment(workingNote.content);
      syncAvalaibleReferences(fragment);
      firstSync.current = true;
    }
  }, [workingNote]);

  const onChangeData = async () => {
    sendIpcRequest(
      IPC_EVENTS.notes_items_update_content,
      workingNoteId,
      editorRef.current.getData()
    );
  };

  return (
    <>
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
        contextEvent={contextEvent}
        editorRef={editorRef}
      />

      <ReferenceBibleModal {...bibleReferenceModal} />
    </>
  );
}

function Editor({
  data,
  workingNoteId,
  ready,
  setReady,
  refereToDocument,
  contextEvent,
  editorRef,
  onChange,
}: {
  data: string | null;
  workingNoteId: string;
  ready: boolean;
  refereToDocument: (type: string) => void;
  setReady: React.Dispatch<React.SetStateAction<boolean>>;
  onChange: () => void;
  contextEvent: React.MutableRefObject<MouseEvent | null>;
  editorRef: React.MutableRefObject<any>;
}) {
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
            text: 'Référence document',
            onclick: () => refereToDocument('document'),
          },
          {
            text: 'Référence biblique',
            onclick: () => refereToDocument('bible'),
          },
        ]
      );

      chromeContextMenu.container.addEventListener(
        'contextmenu',
        contextHandler
      );

      chromeContextMenu.install();
    }
    return () => {
      chromeContextMenu && chromeContextMenu.uninstall();
      chromeContextMenu &&
        chromeContextMenu.container.removeEventListener(
          'contextmenu',
          contextHandler
        );
    };
  }, [ready]);
  return (
    <div>
      <ContainerScrollY
        susDiff={40}
        style={{
          padding: '20px',
          borderRadius: '2px',
        }}
      >
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
                  editor.ui.getEditableElement().parentElement.parentElement
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
                decorators: [
                  {
                    mode: 'automatic',
                    callback: (url: string) =>
                      typeof url === 'string' &&
                      url.includes(referenceDocumentBrandLink),
                    attributes: {
                      title: 'Référence document',
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
                      title: 'Référence biblique',
                      reference: 'true',
                      bible: 'true',
                      onclick: 'event.preventDefault()',
                    },
                  },
                ],
              },
              language: 'fr',
              licenseKey: '',
            }}
          />
        </div>
      </ContainerScrollY>
    </div>
  );
}
