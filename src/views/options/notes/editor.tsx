import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContainerScrollY from '../../../components/container-scroll-y';
//@ts-ignore
import { CKEditor } from '@ckeditor/ckeditor5-react';
//@ts-ignore
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import '@ckeditor/ckeditor5-build-decoupled-document/build/translations/fr';
import { ContextMenu } from '../../../../modules/context-menu/context';
import {
  Button,
  Input,
  Modal,
  Space,
  Tooltip,
  message,
  Typography,
} from 'antd';
import {
  LeftOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { debounce, substrAfter } from '../../../utils/functions';
import { NoteItem, NoteItemReference } from '../../../types';
import sendIpcRequest from '../../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../../utils/ipc-events';
import { useValueStateRef } from '../../../utils/hooks';
import { useDocumentViewOpen } from '../../../components/viewer/document-viewer';
import { selectedSubjectDocumentItem } from '../../../store';
import { useSetRecoilState } from 'recoil';

const items = DecoupledEditor.defaultConfig.toolbar.items as string[];
DecoupledEditor.defaultConfig.toolbar.items = items.filter(
  (i) => !['mediaEmbed', 'uploadImage'].includes(i)
);

function styleProperty(color = '#fff') {
  return {
    backgroundColor: color,
  };
}

const referenceBrandLink = '#reference-';

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
}: {
  backToNotes: () => void;
  workingNote: NoteItem | null;
}) {
  const openModal = useRenameNote(workingNote);

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
        <Tooltip title="Exporter au format PDF">
          <Button type="dashed" icon={<FilePdfOutlined />} />
        </Tooltip>
        <Tooltip title="Exporter au format Word">
          <Button type="dashed" icon={<FileWordOutlined />} />
        </Tooltip>
      </Space>
    </div>
  );
}

const useShowReferenceDetail = () => {
  const viewDocument = useDocumentViewOpen();
  const setSubjectItemSelected = useSetRecoilState(selectedSubjectDocumentItem);

  const modal = useCallback(
    (reference: NoteItemReference, workingNote: NoteItem) => {
      const assigned = (reference.documentHtmlTree || []).length > 0;

      const openDocument = () => {
        viewDocument(reference.documentTitle, () => {
          //@ts-ignore
          setSubjectItemSelected({
            subject: '',
            documentHtmlTree: reference.documentHtmlTree,
            documentTitle: reference.documentTitle,
            textContent: reference.textContent,
          });
        });
      };

      Modal[assigned ? 'info' : 'warning']({
        closable: true,
        onOk: assigned ? openDocument : undefined,
        okText: assigned ? 'Ouvrir' : 'Fermer',
        title: (
          <span>
            {workingNote.name} - {reference.label}
          </span>
        ),
        content: assigned ? (
          <div>
            <p>Document: {reference.documentTitle}</p>
            <p>
              <Typography.Text>
                {(reference.textContent || '').slice(0, 30)}...
              </Typography.Text>
            </p>
          </div>
        ) : (
          <div>
            <p>Aucun document n'a été attribué pour cette référence</p>
          </div>
        ),
      });
    },
    []
  );

  return modal;
};

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

  useEffect(() => {
    sendIpcRequest<NoteItem>(
      IPC_EVENTS.notes_items_get,
      workingNoteId
    ).then((note) => setWorkingNote(note));
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

  useEffect(() => {
    const editor = editorRef.current;
    const handleEditorLinks = (e: MouseEvent) => {
      const target = e.target as HTMLLinkElement;
      if (
        target.tagName === 'A' &&
        target.getAttribute('href')?.startsWith(referenceBrandLink)
      ) {
        const str = target.getAttribute('href') as string;
        const substr = referenceBrandLink;
        handleEditorLinksClick(substrAfter(str, substr));
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

  const refereToDocument = useCallback(async () => {
    const editor = editorRef.current;
    if (contextEvent.current && contextEvent.current.target) {
      const target = contextEvent.current.target as HTMLElement;
      if (
        target.tagName === 'A' &&
        target.getAttribute('href')?.startsWith(referenceBrandLink)
      ) {
        return;
      }

      const selected = window.getSelection()?.toString().trim();

      if (selected && selected.length > 1) {
        sendIpcRequest<NoteItemReference>(
          IPC_EVENTS.notes_references_store,
          workingNoteIdRef.current
        ).then((ref) => {
          editor.execute('link', referenceBrandLink + ref._id);
          message.success(`Label: ${ref.label}`);
        });
      } else {
        message.error('Pas de sélection pour référence');
      }
    }
  }, []);

  const syncAvalaibleReferences = () => {
    const editor = editorRef.current;
    const editorEl = editor.ui.getEditableElement() as HTMLElement;
    const references = Array.from(editorEl.querySelectorAll('a[href]'))
      .filter((link) =>
        link.getAttribute('href')?.startsWith(referenceBrandLink)
      )
      .map((link) => {
        const str = link.getAttribute('href') as string;
        const substr = referenceBrandLink;
        return substrAfter(str, substr);
      });

    sendIpcRequest(
      IPC_EVENTS.notes_references_sync,
      workingNoteIdRef.current,
      references
    );
  };

  const onChangeData = async () => {
    sendIpcRequest(
      IPC_EVENTS.notes_items_update_content,
      workingNoteId,
      editorRef.current.getData()
    ).finally(() => {
      syncAvalaibleReferences();
    });
  };

  return (
    <>
      <ButtonsControllers workingNote={workingNote} backToNotes={backToNotes} />
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
  refereToDocument: () => void;
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
        [{ text: 'Référence', onclick: refereToDocument }]
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
        susDiff={60}
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
            editor={DecoupledEditor}
            data={data || ''}
            config={{
              language: 'fr',
            }}
          />
        </div>
      </ContainerScrollY>
    </div>
  );
}
