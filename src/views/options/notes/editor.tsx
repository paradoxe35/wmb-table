import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContainerScrollY from '../../../components/container-scroll-y';
//@ts-ignore
import { CKEditor } from '@ckeditor/ckeditor5-react';
//@ts-ignore
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import  '@ckeditor/ckeditor5-build-decoupled-document/build/translations/fr';
import { ContextMenu } from '../../../../modules/context-menu/context';

const items = DecoupledEditor.defaultConfig.toolbar.items as string[]
DecoupledEditor.defaultConfig.toolbar.items = items.filter(i => !['mediaEmbed', 'uploadImage'].includes(i))

function styleProperty(color = '#fff') {
  return {
    backgroundColor: color,
  };
}

function ButtonsControllers() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        margin: '12px 0',
      }}
    ></div>
  );
}

export default function EditorContent({}) {
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const contextEvent = useRef<MouseEvent | null>(null);

  useEffect(() => {
    console.log(DecoupledEditor.defaultConfig);

    if (editorRef.current && editorRef.current.editor) {
      editorRef.current.editor.ui.view.toolbar.element.remove();
    }
  }, []);

  const refereToDocument = useCallback(() => {
    console.log(contextEvent.current);
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
    <>
      <ButtonsControllers />
      <div>
        <ContainerScrollY
          susDiff={47}
          style={{
            background: '#949494',
            padding: '20px',
            borderRadius: '2px',
          }}
        >
          <div style={{ ...styleProperty(), borderRadius: '5px' }}>
            <CKEditor
              //@ts-ignore
              onReady={(editor) => {
                editor.ui
                  .getEditableElement()
                  .parentElement.parentElement.parentElement.insertBefore(
                    editor.ui.view.toolbar.element,
                    editor.ui.getEditableElement().parentElement.parentElement
                  );
                editorRef.current = editor;
                setReady(true);
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
              config={{
                language: 'fr'
               }}
            />
          </div>
        </ContainerScrollY>
      </div>
    </>
  );
}
