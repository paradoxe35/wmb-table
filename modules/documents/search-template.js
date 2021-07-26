import {
  searchTemplateHtml,
  searchTemplateCss,
  injectStyleText,
  zoomInTemplate,
  zoomOutTemplate,
} from './html.js';

import { SEARCH_RESULT, SEARCH_QUERY, WINDOW_ZOOM } from './seach-query.js';
import { performSearch } from './peform-search.js';

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
  if (WINDOW_ZOOM >= 100) {
    // @ts-ignore
    el?.querySelector('.icon-data')?.innerHTML = zoomInTemplate;
  } else {
    // @ts-ignore
    el?.querySelector('.icon-data')?.innerHTML = zoomOutTemplate;
  }
  // @ts-ignore
  el?.querySelector('.zoom-data')?.textContent = WINDOW_ZOOM + '%';
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

window.addEventListener('search-open-popup', () => {
  searchOpenPopup();
});

window.addEventListener('search-open', () => {
  searchOpenPopup();
  openSearchModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const searchContainer = document.querySelector('.search--template');
    if (searchContainer && searchContainer.classList.contains('active')) {
      searchContainer.classList.remove('active');
      window.parent.dispatchEvent(new Event('close-document-query'));
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

  window.addEventListener('search-result', (_e) => {
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

  window.addEventListener('result-constructed', () => {
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
      if (searchContainer && searchContainer.classList.contains('active')) {
        searchContainer.classList.remove('active');
        window.parent.dispatchEvent(new Event('close-document-query'));
      }
    });

  handleSearch();

  performSearch(SEARCH_QUERY ? SEARCH_QUERY.term : undefined);

  searchOpen && searchOpen.addEventListener('click', () => openSearchModal());
}

export function openSearchModal() {
  window.parent.dispatchEvent(new Event('open-search-modal'));
}
