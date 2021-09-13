//@ts-check
import './context-menu/kali_dark.css.js';
import contextMenuHandler from './documents/context-menu.js';
import { scrollToViewTree } from './documents/document-tree.js';
import { pageContainer } from './documents/functions.js';
import {
  setSearchQuery,
  SEARCH_RESULT,
  setWindowPostion,
  WINDOW_POSITION,
  setWindowZoom,
} from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';

const container = pageContainer();

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
      case 'document-zoom':
        setWindowZoom(e.data.detail);
        break;
    }
  },
  false
);
// call this when event post message has initialized
window.setTimeout(() => {
  window.parent.dispatchEvent(new Event('document-view-loaded'));
}, 100);

// center page to center
function defaultPosition() {
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

contextMenuHandler();

container.focus();

container.addEventListener('click', (event) => {
  /** @type { HTMLLinkElement} */
  // @ts-ignore
  let target = event.target;
  const hasLink = [
    target,
    target.parentElement,
    target.parentElement?.parentElement,
  ].some((el) => el && el.tagName === 'A');
  hasLink && event.preventDefault();
});

window.addEventListener('result-constructed', () => {
  if (!SEARCH_RESULT || SEARCH_RESULT.matches.length <= 0) {
    defaultPosition();
  }
});

// const refocus = () => container.focus();
// refocus();

// container.addEventListener('scroll', debounce(refocus, 1000));
