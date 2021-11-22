import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
} from '../shared/shared.js';
import { ContextMenu } from '../context-menu/context.js';
import { pageContainer, zoomIn, zoomOut } from './functions.js';
import { setWindowZoom } from './seach-query.js';
import { selectedTextAsReference } from './document-tree.js';

function copyTextSelection() {
  let selObj = window.getSelection();
  let text = null;
  if ((text = selObj?.toString())) {
    navigator.clipboard.writeText(text);
  }
}

const container = pageContainer();

function searchOpen() {
  window.dispatchEvent(new Event(CHILD_WINDOW_EVENT.searchOpen));
}

/**
 * @param {string} event
 */
function addDocumentNodeToItem(event) {
  const range = selectedTextAsReference();

  if (!range) return;

  window.parent.dispatchEvent(
    new CustomEvent(event, {
      detail: {
        textContent: range.contextualText,
        documentHtmlTree: {
          tree: range.startContainer,
          scrollY: container.scrollTop,
          scrollX: container.scrollLeft,
          ranges: { ...range, contextualText: null },
        },
      },
    })
  );
}

export const handleZoomIn = () => {
  const zoom = zoomIn();
  if (zoom === false) return;
  setWindowZoom(zoom);
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, {
      detail: { zoom },
    })
  );
};

export const handleZoomOut = () => {
  const zoom = zoomOut();
  if (zoom === false) return;
  setWindowZoom(zoom);
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, {
      detail: { zoom },
    })
  );
};

export default () => {
  const chromeContextMenu = new ContextMenu(container, [
    {
      text: 'Agrandir',
      hotkey: 'Ctrl+Shift+',
      onclick: handleZoomIn,
    },
    {
      text: 'Dézoomer',
      hotkey: 'Ctrl-',
      onclick: handleZoomOut,
    },
    null,
    {
      text: 'Copier texte',
      hotkey: 'Ctrl+C',
      onclick: copyTextSelection,
    },
    {
      text: 'Recherche',
      hotkey: 'Ctrl+F',
      onclick: searchOpen,
    },
    null,
    {
      text: 'Ajouter à un sujet',
      onclick: () =>
        addDocumentNodeToItem(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject),
    },
    {
      text: 'Ajouter comme référence note',
      onclick: () =>
        addDocumentNodeToItem(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote),
    },
  ]);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
      switch (event.key.toLocaleLowerCase()) {
        case 'f':
          searchOpen();
          break;
        case '+':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        default:
          break;
      }
    }
  });

  chromeContextMenu.install();
};
