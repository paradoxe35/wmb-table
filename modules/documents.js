//@ts-check
import './documents/html.js';
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
  setDocumentTitleData,
} from './documents/seach-query.js';
import searchTemplate from './documents/search-template.js';
import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
  POST_MESSAGE_EVENT,
} from './shared/shared.js';

const container = pageContainer();

//events
window.addEventListener(
  'message',
  (e) => {
    switch (e.data.type) {
      case POST_MESSAGE_EVENT.documentQuery:
        setSearchQuery(e.data.detail);
        searchTemplate();
        break;
      case POST_MESSAGE_EVENT.subjectItem:
        scrollToViewTree(e.data.detail);
        break;
      case POST_MESSAGE_EVENT.windowPosition:
        setWindowPostion(e.data.detail);
        break;
      case POST_MESSAGE_EVENT.documentZoom:
        setWindowZoom(e.data.detail);
        break;
      case POST_MESSAGE_EVENT.documentTitleData:
        setDocumentTitleData(e.data.detail);
        break;
    }
  },
  false
);
// call this when event post message has initialized
window.setTimeout(() => {
  window.parent.dispatchEvent(
    new Event(CHILD_PARENT_WINDOW_EVENT.documentViewLoaded)
  );
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

window.addEventListener(CHILD_WINDOW_EVENT.resultConstructed, () => {
  if (!SEARCH_RESULT || SEARCH_RESULT.matches.length <= 0) {
    defaultPosition();
  }
});

// const refocus = () => container.focus();
// refocus();

// container.addEventListener('scroll', debounce(refocus, 1000));
