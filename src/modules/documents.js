//@ts-check
import '../plugins/context-menu/kali_dark.css.js';
import contextMenuHander from './documents/context-menu.js';
import {
  setSearchQuery,
  SEARCH_QUERY,
  SEARCH_RESULT,
  setSearchQueryTerm,
  setWindowPostion,
  WINDOW_POSITION,
} from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';
import { performSearch } from './documents/peform-search.js';

// center page to center
function defaultPosition() {
  var container = document.getElementById('page-container').firstElementChild
    .firstElementChild;
  if (WINDOW_POSITION) {
    const page = document.querySelector('#page-container');
    page.scrollTo({
      top: WINDOW_POSITION.top || undefined,
      left: WINDOW_POSITION.left || undefined,
      behavior: 'smooth',
    });
  } else {
    container.querySelector('div').scrollIntoView({ inline: 'center' });
  }
}

// call fn
contextMenuHander();

//events
window.addEventListener(
  'message',
  (e) => {
    switch (e.data.type) {
      case 'document-query':
        setSearchQuery(e.data.detail);
        searchTemplate();
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
