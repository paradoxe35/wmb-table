import {
  searchTemplateHtml,
  searchTemplateCss,
  injectStyleText,
  zoomInTemplate,
  zoomOutTemplate,
} from './html.js';

import { SEARCH_RESULT, SEARCH_QUERY, WINDOW_ZOOM } from './seach-query.js';
import { performSearch } from './peform-search.js';
import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
} from '../shared/shared.js';
import { pageContainer } from './functions.js';

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

let hasOpened = false;

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

const showZoomDetail = () => {
  const el = document.querySelector('.search--zoom--js');
  const iconEl = el?.querySelector('.icon-data');
  const detailEl = el?.querySelector('.zoom-data');
  if (WINDOW_ZOOM >= 100) {
    iconEl && (iconEl.innerHTML = zoomInTemplate);
  } else {
    iconEl && (iconEl.innerHTML = zoomOutTemplate);
  }
  detailEl && (detailEl.textContent = WINDOW_ZOOM.toString());
};

const searchOpenPopup = () => {
  if (hasOpened) {
    const searchContainer = document.querySelector('.search--template');
    addClass(searchContainer, 'active');
  } else {
    initTemplate();
  }
  showZoomDetail();
};

window.addEventListener(CHILD_WINDOW_EVENT.searchOpenPopup, () => {
  searchOpenPopup();
});

window.addEventListener(CHILD_WINDOW_EVENT.searchOpen, () => {
  searchOpenPopup();
  openSearchModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const searchContainer = document.querySelector('.search--template');
    if (searchContainer && searchContainer.classList.contains('active')) {
      searchContainer.classList.remove('active');
      window.parent.dispatchEvent(
        new Event(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery)
      );
    }
  }
});

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

export default function initTemplate() {
  const container = pageContainer();
  hasOpened = true;

  injectStyleText(searchTemplateCss);

  document.body.appendChild(
    document.createRange().createContextualFragment(searchTemplateHtml)
  );

  const searchContainer = document.querySelector('.search--template');
  const searchOpen = document.querySelector('.search--open--js');
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

      if (searchContainer && searchContainer.classList.contains('active')) {
        searchContainer.classList.remove('active');
        window.parent.dispatchEvent(
          new Event(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery)
        );
      }
    });

  handleSearch();

  performSearch(SEARCH_QUERY ? SEARCH_QUERY : undefined);

  searchOpen && searchOpen.addEventListener('click', () => openSearchModal());

  showZoomDetail();
}

export function openSearchModal() {
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
