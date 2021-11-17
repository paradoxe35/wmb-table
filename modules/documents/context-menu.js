import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
} from '../shared/shared.js';
import { ContextMenu } from '../context-menu/context.js';
import {
  closestChildParent,
  pageContainer,
  zoomIn,
  zoomOut,
} from './functions.js';
import { setWindowZoom } from './seach-query.js';

function copyTextSelection() {
  let selObj = window.getSelection();
  let text = null;
  if ((text = selObj?.toString())) {
    navigator.clipboard.writeText(text);
  }
}

function searchOpen() {
  window.dispatchEvent(new Event(CHILD_WINDOW_EVENT.searchOpen));
}

function searchOpenPopup() {
  window.dispatchEvent(new Event(CHILD_WINDOW_EVENT.searchOpenPopup));
}

/**
 * @type {Element | null}
 */
let lastNodeTargetFromContent = null;

/**
 * @param {string} event
 */
function addDocumentNodeToItem(event) {
  if (!lastNodeTargetFromContent) return;
  if (lastNodeTargetFromContent.tagName === 'MARK') {
    lastNodeTargetFromContent = lastNodeTargetFromContent.parentElement;
  }
  const documentHtmlTree = closestChildParent(
    // @ts-ignore
    lastNodeTargetFromContent,
    document.body
  );
  // @ts-ignore
  const textContent = lastNodeTargetFromContent.textContent;

  const container = pageContainer();

  window.parent.dispatchEvent(
    new CustomEvent(event, {
      detail: {
        textContent,
        documentHtmlTree: {
          tree: documentHtmlTree,
          scrollY: container.scrollTop,
          scrollX: container.scrollLeft,
        },
      },
    })
  );
}

const handleZoomIn = () => {
  const zoom = zoomIn();
  if (zoom === false) return;
  setWindowZoom(zoom);
  searchOpenPopup();
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, {
      detail: { zoom },
    })
  );
};

const handleZoomOut = () => {
  const zoom = zoomOut();
  if (zoom === false) return;
  setWindowZoom(zoom);
  searchOpenPopup();
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, {
      detail: { zoom },
    })
  );
};

export default () => {
  const chromeContextMenu = new ContextMenu(document.body, [
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

  // @ts-ignore
  chromeContextMenu.container.addEventListener('contextmenu', (e) => {
    // @ts-ignore
    lastNodeTargetFromContent = e.target;
  });

  chromeContextMenu.install();
};
