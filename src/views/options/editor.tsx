import React, { useEffect, useRef } from 'react';
//@ts-ignore
import { CKEditor } from '@ckeditor/ckeditor5-react';
//@ts-ignore
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import ContainerScrollY from '../../components/container-scroll-y';

export default function Editor() {
  return (
    <>
      <EditorContent />
    </>
  );
}

function styleProperty() {
  return {
    backgroundColor: '#fff',
  };
}
function styleEditor(editor: any) {
  const editorEl: HTMLElement = editor.ui.getEditableElement();
  Object.keys(styleProperty()).forEach((k) => {
    //@ts-ignore
    editorEl.style[k] = styleProperty()[k];
  });
}

function EditorContent() {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.editor) {
      editorRef.current.editor.ui.view.toolbar.element.remove();
    }
  }, []);

  return (
    <div>
      <ContainerScrollY
        susDiff={47}
        style={{
          padding: '20px 0',
          borderRadius: '2px',
        }}
      >
        <div style={styleProperty()}>
          <CKEditor
            //@ts-ignore
            onReady={(editor) => {
              console.log('Editor is ready to use!', editor);
              editor.ui
                .getEditableElement()
                .parentElement.parentElement.parentElement.insertBefore(
                  editor.ui.view.toolbar.element,
                  editor.ui.getEditableElement().parentElement.parentElement
                );
              editorRef.current = editor;
            }}
            //@ts-ignore
            onError={({ willEditorRestart }) => {
              if (willEditorRestart) {
                editorRef.current.editor.ui.view.toolbar.element.remove();
              }
            }}
            //@ts-ignore
            onChange={(event, editor) => console.log({ event, editor })}
            editor={DecoupledEditor}
            data="<p>Hello from CKEditor 5's decoupled editor!</p>"
            // config={/* the editor configuration */}
          />
        </div>
      </ContainerScrollY>
    </div>
  );
}

function Notes() {
  return <>editor</>;
}
