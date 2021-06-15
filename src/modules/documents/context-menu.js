import { ContextMenu } from '../../plugins/context-menu/context.js';
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

function addDocumentNodeToSubject() {
  if (!lastNodeTargetFromContent) return;
  const documentHtmlTree = closestChildParent(
    lastNodeTargetFromContent,
    document.body
  );
  const textContent = lastNodeTargetFromContent.textContent;

  window.parent.dispatchEvent(
    new CustomEvent('add-document-ref-subject', {
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
      onclick: addDocumentNodeToSubject,
    },
  ]);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLocaleLowerCase() === 'f') {
      searchOpen();
    }
  });

  // @ts-ignore
  chromeContextMenu.container.addEventListener('contextmenu', (e) => {
    lastNodeTargetFromContent = e.target;
  });

  chromeContextMenu.install();
};
