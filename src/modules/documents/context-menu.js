import { ContextMenu } from '../../plugins/context-menu/context.js';

function copyTextSelection() {
  var selObj = window.getSelection();
  var text = null;
  if ((text = selObj?.toString())) {
    navigator.clipboard.writeText(text);
  }
}

/**
 * @param { HTMLElement | Element } element
 * @param { HTMLElement | Element } target
 */
function closestChildParent(element, target) {
  if (!target || !element) return null;

  let child = element;
  const arr = [];

  while (child && child !== target && child !== document.body) {
    // @ts-ignore
    arr.push(Array.prototype.indexOf.call(child.parentElement.children, child));
    // @ts-ignore
    child = child.parentElement;
  }

  return [...arr.reverse()];
}

/**
 * @param { HTMLElement | Element } target
 * @param { Array<number> } arr
 */
function getChildByTreeArr(target, arr) {
  // @ts-ignore
  let element = null;
  let lastEl = target;
  arr.forEach((index) => {
    if (lastEl) {
      lastEl = lastEl.children[index];
    }
  });
  return lastEl;
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

  // @ts-ignore
  chromeContextMenu.container.addEventListener('contextmenu', (e) => {
    // console.log(Array.prototype.indexOf.call(document.body.ners, e.target));
    const target = document.body;
    const childTree = closestChildParent(e.target, target);
    console.log(childTree);
    // @ts-ignore
    console.log(getChildByTreeArr(target, childTree));
  });

  chromeContextMenu.install();
};
