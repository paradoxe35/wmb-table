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

function styleProperty(color = '#fff') {
  return {
    backgroundColor: color,
  };
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
          background: '#949494',
          padding: '20px',
          borderRadius: '2px',
        }}
      >
        <div style={{ ...styleProperty(), borderRadius: "5px" }}>
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
