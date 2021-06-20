import { ContextMenu } from '../context-menu/context.js';
import { closestChildParent } from './functions.js';

function copyTextSelection() {
  let selObj = window.getSelection();
  let text = null;
  if ((text = selObj?.toString())) {
    navigator.clipboard.writeText(text);
  }
}

function searchOpen() {
  window.dispatchEvent(new Event('search-open'));
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

  window.parent.dispatchEvent(
    new CustomEvent(event, {
      detail: { textContent, documentHtmlTree },
    })
  );
}

export default () => {
  const chromeContextMenu = new ContextMenu(document.body, [
    { text: 'Copier texte', hotkey: 'Ctrl+C', onclick: copyTextSelection },
    { text: 'Recherche', hotkey: 'Ctrl+F', onclick: searchOpen },
    {
      text: 'Ajouter à un sujet',
      onclick: () => addDocumentNodeToItem('add-document-ref-subject'),
    },
    {
      text: 'Ajouter comme référence',
      onclick: () => addDocumentNodeToItem('add-document-ref-note'),
    },
  ]);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLocaleLowerCase() === 'f') {
      searchOpen();
    }
  });

  // @ts-ignore
  chromeContextMenu.container.addEventListener('contextmenu', (e) => {
    // @ts-ignore
    lastNodeTargetFromContent = e.target;
  });

  chromeContextMenu.install();
};
