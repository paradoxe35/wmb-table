import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContainerScrollY from '../../../components/container-scroll-y';
//@ts-ignore
import { CKEditor } from '@ckeditor/ckeditor5-react';
//@ts-ignore
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import '@ckeditor/ckeditor5-build-decoupled-document/build/translations/fr';
import { ContextMenu } from '../../../../modules/context-menu/context';
import { Button, Input, Modal, Space, Tooltip, message } from 'antd';
import {
  LeftOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { debounce } from '../../../utils/functions';
import { NoteItem } from '../../../types';
import sendIpcRequest from '../../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../../utils/ipc-events';
import { useValueStateRef } from '../../../utils/hooks';

const items = DecoupledEditor.defaultConfig.toolbar.items as string[];
DecoupledEditor.defaultConfig.toolbar.items = items.filter(
  (i) => !['mediaEmbed', 'uploadImage'].includes(i)
);

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

export default function EditorContent({
  workingNoteId,
  backToNotes,
}: {
  workingNoteId: string;
  backToNotes: () => void;
}) {
  const editorRef = useRef<any>(null);

  const contextEvent = useRef<MouseEvent | null>(null);

  const [workingNote, setWorkingNote] = useState<NoteItem | null>(null);

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

  const refereToDocument = useCallback(() => {
    console.log(contextEvent.current);
  }, []);

  const onChangeData = () => {
    sendIpcRequest(
      IPC_EVENTS.notes_items_update_content,
      workingNoteId,
      editorRef.current.getData()
    );
  };

  return (
    <>
      <ButtonsControllers workingNote={workingNote} backToNotes={backToNotes} />
      <Editor
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
  refereToDocument,
  contextEvent,
  editorRef,
  onChange,
}: {
  data: string | null;
  workingNoteId: string;
  refereToDocument: () => void;
  onChange: () => void;
  contextEvent: React.MutableRefObject<MouseEvent | null>;
  editorRef: React.MutableRefObject<any>;
}) {
  const [ready, setReady] = useState(false);

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
        <div style={{ ...styleProperty(), borderRadius: '5px' }}>
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
            onChange={debounce(onChange, 500)}
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
