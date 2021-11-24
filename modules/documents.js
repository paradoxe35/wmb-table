//@ts-check
import './documents/html.js';
import './context-menu/kali_dark.css.js';
import contextMenuHandler from './documents/context-menu.js';
import { scrollToRangesTreeView } from './documents/document-tree.js';
import { pageContainer } from './documents/functions.js';
import {
  setSearchQuery,
  SEARCH_RESULT,
  setWindowPostion,
  WINDOW_POSITION,
  setWindowZoom,
  setDocumentTitleData,
  setCurrentAudioDocumentPlayData,
  setSubjectNoteReferencePosition,
} from './documents/seach-query.js';
import initSearchableTemplate from './documents/search-template.js';
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
        initSearchableTemplate();
        break;
      case POST_MESSAGE_EVENT.subjectItem:
        setSubjectNoteReferencePosition(e.data.detail)
        scrollToRangesTreeView(e.data.detail);
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
      case POST_MESSAGE_EVENT.currentAudioDocumentPlay:
        setCurrentAudioDocumentPlayData(e.data.detail);
        break;
    }
  },
  false
);

// call this when event post message has initialized
const readyDocumentNotify = () => {
  window.parent.dispatchEvent(
    new Event(CHILD_PARENT_WINDOW_EVENT.documentViewLoaded)
  );
};

// wait until full docuement is loaded
window.setTimeout(readyDocumentNotify, 100);
// request for post message
window.addEventListener(
  POST_MESSAGE_EVENT.requestForPostMessage,
  readyDocumentNotify
);

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
    container?.scrollIntoView({
      inline: 'center',
    });
  }
}

contextMenuHandler();

container.focus();

// prevent link to open
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
  if (!SEARCH_RESULT.value || SEARCH_RESULT.value.matches.length <= 0) {
    defaultPosition();
  }
});
