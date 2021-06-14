//@ts-check
import { ContextMenu } from '../../plugins/context-menu/context.js';

function copyTextSelection() {
  var selObj = window.getSelection();
  var text = null;
  if ((text = selObj?.toString())) {
    navigator.clipboard.writeText(text);
  }
}

function searchOpen() {
  window.dispatchEvent(new Event('search-open'));
}

export default () => {
  const chromeContextMenu = new ContextMenu(document.body, [
    { text: 'Copier texte', hotkey: 'Ctrl+C', onclick: copyTextSelection },
    { text: 'Recherche', hotkey: 'Ctrl+F', onclick: searchOpen },
  ]);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLocaleLowerCase() === 'f') {
      searchOpen();
    }
  });

  chromeContextMenu.install();
};
