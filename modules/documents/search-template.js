import {
  SEARCH_RESULT,
  SEARCH_QUERY,
  WINDOW_ZOOM,
  DOCUMENT_TITLE_DATAS,
} from './seach-query.js';
import { performSearch } from './peform-search.js';
import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
} from '../shared/shared.js';
import { pageContainer } from './functions.js';
import { handleZoomIn, handleZoomOut } from './context-menu.js';

/**
 * @param {Element | null} el
 * @param {string} className
 */
function addClass(el, className) {
  el && !el.classList.contains(className) && el.classList.add(className);
}

/**
 * @param {Element | null} el
 * @param {string} className
 */
function removeClass(el, className) {
  el && el.classList.contains(className) && el.classList.remove(className);
}

const container = pageContainer();

/**
 * @type {null | number}
 */
let lastIndex = null;

/**
 * @param {number | null} index
 */
function navigateOnResult(index) {
  if (index == lastIndex) return;

  if (lastIndex) {
    /** @type { HTMLElement[] } */
    // @ts-ignore
    const pMarks = document.querySelectorAll(
      `mark[data-mark-id="${lastIndex}"]`
    );
    pMarks.forEach((el) => (el.style.backgroundColor = 'yellow'));
  }

  /** @type { HTMLElement[] } */
  const marks = Array.from(
    document.querySelectorAll(`mark[data-mark-id="${index}"]`)
  );

  marks.forEach((el) => (el.style.backgroundColor = '#57aeff'));

  if (marks[0]) {
    marks[0].scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'center',
    });
    lastIndex = index;
  }
}

export function handleSearch() {
  const searchPrev = document.querySelector('.search--prev--js');
  const searchNext = document.querySelector('.search--next--js');
  const searchResult = document.querySelector('.search--result--js');

  let indexSearch = 1;

  const updateResult = () => {
    if (!searchResult) return;
    searchResult.textContent = `${indexSearch}/${
      SEARCH_RESULT ? SEARCH_RESULT.matches.length : 0
    }`;
  };

  window.addEventListener(CHILD_WINDOW_EVENT.searchResult, (_e) => {
    if (!SEARCH_RESULT || SEARCH_RESULT.matches.length < 1) {
      indexSearch = 0;
    } else {
      indexSearch = 1;
    }
    if (!SEARCH_RESULT) {
      addClass(searchPrev, 'disabled');
      addClass(searchNext, 'disabled');
      // @ts-ignore
      searchResult.textContent = `0/0`;
    } else {
      addClass(searchPrev, 'disabled');
      if (indexSearch == SEARCH_RESULT.matches.length) {
        addClass(searchNext, 'disabled');
      } else {
        removeClass(searchNext, 'disabled');
      }
      lastIndex = null;
      navigateOnResult(indexSearch);

      updateResult();
    }
  });

  window.addEventListener(CHILD_WINDOW_EVENT.resultConstructed, () => {
    navigateOnResult(indexSearch);
  });

  searchPrev &&
    searchPrev.addEventListener('click', () => {
      if (searchPrev.classList.contains('disabled') || !SEARCH_RESULT) return;

      indexSearch -= 1;

      if (indexSearch <= 1) {
        addClass(searchPrev, 'disabled');
      }

      if (indexSearch < SEARCH_RESULT.matches.length) {
        removeClass(searchNext, 'disabled');
      }

      navigateOnResult(indexSearch);

      updateResult();
    });

  searchNext &&
    searchNext.addEventListener('click', () => {
      if (searchNext.classList.contains('disabled') || !SEARCH_RESULT) return;

      indexSearch += 1;

      if (indexSearch == SEARCH_RESULT.matches.length) {
        addClass(searchNext, 'disabled');
      }

      if (indexSearch > 1) {
        removeClass(searchPrev, 'disabled');
      }

      navigateOnResult(indexSearch);

      updateResult();
    });
}

export default function initSearchableTemplate() {
  const searchField = Array.from(document.querySelectorAll('.search--field'));
  const searchClose = document.querySelector('.search--close--js');

  searchClose &&
    searchClose.addEventListener('click', () => {
      Array.from(container.querySelectorAll('[data-mark-id]')).forEach((el) => {
        el.parentElement?.insertBefore(
          document.createTextNode(el.textContent || ''),
          el
        );
        el.parentNode?.removeChild(el);
      });
      searchField.forEach((el) => el.classList.add('display-none'));
      window.parent.dispatchEvent(
        new Event(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery)
      );
    });

  // show seach fields
  searchField.forEach((el) => el.classList.remove('display-none'));

  handleSearch();

  performSearch(SEARCH_QUERY ? SEARCH_QUERY : undefined);
}

/**
 * Zoom handler
 */
function zoomHandler() {
  // update zoom status
  const zoomValueEl = document.querySelector('.search--zoom-data--js');
  const uzoom = (/** @type {number} */ value) => {
    zoomValueEl && (zoomValueEl.textContent = value.toString());
  };
  WINDOW_ZOOM.registerNewListener(uzoom);

  // zoom controllers
  // zoom in
  document
    .querySelector('.search--zoom-in--js')
    ?.addEventListener('click', handleZoomIn);

  // zoom out
  document
    .querySelector('.search--zoom-out--js')
    ?.addEventListener('click', handleZoomOut);
}
zoomHandler();

function openSearchModal() {
  let text = null;

  const selection = window.getSelection()
    ? // @ts-ignore
      window.getSelection().toString().trim()
    : null;
  if (selection && selection.length > 1 && selection.length <= 80) {
    text = selection;
  }
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.openSearchModal, { detail: text })
  );
}

/**
 * search modal handler
 */
function searchModalHandler() {
  // open search modal
  document
    ?.querySelector('.search--open--js')
    ?.addEventListener('click', openSearchModal);

  // open search from event listener
  window.addEventListener(CHILD_WINDOW_EVENT.searchOpen, openSearchModal);
}
searchModalHandler();

/**
 * document external links handler
 */
function handleDocumentExternalWebLink() {
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.openDocumentExternalLink, {
      detail: DOCUMENT_TITLE_DATAS.value?.web_link,
    })
  );
}

/**
 * @param {import("@localtypes/index").Title<string | null, string> | null} data
 */
function documentTitleDataHandler(data) {
  if (!data) return;

  // handle document external links when clicked
  document
    .querySelector('.search--web-link--js')
    ?.addEventListener('click', handleDocumentExternalWebLink);
}

DOCUMENT_TITLE_DATAS.registerNewListener(documentTitleDataHandler);
