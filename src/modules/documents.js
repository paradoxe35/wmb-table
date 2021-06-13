//@ts-check
import '../plugins/context-menu/kali_dark.css.js';
import contextMenuHander from './documents/context-menu.js';
import { setSearchQuery } from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';

// center page to center
var container = document.getElementById('page-container').firstElementChild
  .firstElementChild;
container.querySelector('div').scrollIntoView({ inline: 'center' });

// call fn
contextMenuHander();

//events
window.addEventListener('message', (e) => {
  setSearchQuery(e.data)
  if(e.data) {
    searchTemplate()
  }
}, false);
