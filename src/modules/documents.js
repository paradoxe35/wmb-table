//@ts-check
import '../plugins/context-menu/kali_dark.css.js';
import contextMenuHander from './documents/context-menu.js';
import {
  setSearchQuery,
  SEARCH_QUERY,
  setSearchQueryTerm,
} from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';
import { performSearch } from './documents/peform-search.js';

// center page to center
var container = document.getElementById('page-container').firstElementChild
  .firstElementChild;
container.querySelector('div').scrollIntoView({ inline: 'center' });

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
      case 'search-query':
        if (!SEARCH_QUERY || SEARCH_QUERY.term !== e.data.detail) {
          window.location.reload();
        }
        break;
    }
  },
  false
);
