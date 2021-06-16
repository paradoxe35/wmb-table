//@ts-check
import './context-menu/kali_dark.css.js';
import contextMenuHander from './documents/context-menu.js';
import { scrollToViewTree } from './documents/document-tree.js';
import {
  setSearchQuery,
  SEARCH_RESULT,
  setWindowPostion,
  WINDOW_POSITION,
} from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';

// center page to center
function defaultPosition() {
  // @ts-ignore
  const container = document.getElementById('page-container');
  if (WINDOW_POSITION) {
    // @ts-ignore
    container.scrollTo({
      top: WINDOW_POSITION.top || undefined,
      left: WINDOW_POSITION.left || undefined,
      behavior: 'smooth',
    });
  } else {
    // @ts-ignore
    container.firstElementChild.firstElementChild
      .querySelector('div')
      .scrollIntoView({ inline: 'center' });
  }
}

// call fn
contextMenuHander();

window.focus();

//events
window.addEventListener(
  'message',
  (e) => {
    switch (e.data.type) {
      case 'document-query':
        setSearchQuery(e.data.detail);
        searchTemplate();
        break;
      case 'subject-item':
        scrollToViewTree(e.data.detail);
        break;
      case 'window-position':
        setWindowPostion(e.data.detail);
        break;
    }
  },
  false
);

window.addEventListener('result-constructed', () => {
  if (!SEARCH_RESULT || SEARCH_RESULT.matches.length <= 0) {
    defaultPosition();
  }
});
