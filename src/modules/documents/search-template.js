import {
  searchTemplateHtml,
  searchTemplateCss,
  injectStyleText,
} from './html.js';

import { SEARCH_RESULT, SEARCH_QUERY, setSearchResult } from './seach-query.js';

function addClass(el, className) {
  el && !el.classList.contains(className) && el.classList.add(className);
}

function removeClass(el, className) {
  el && el.classList.contains(className) && el.classList.remove(className);
}

let hasOpened = false;

window.addEventListener('search-open', () => {
  if (hasOpened) {
    const searchContainer = document.querySelector('.search--template');
    addClass(searchContainer, 'active');
  } else {
    initTemplate();
  }
  openSearchModal();
});

export function handleSearch() {
  const searchPrev = document.querySelector('.search--prev--js');
  const searchNext = document.querySelector('.search--next--js');
  const searchResult = document.querySelector('.search--result--js');

  let indexSearch = 0;

  const updateResult = () => {
    searchResult.textContent = `${indexSearch}/${SEARCH_RESULT.matches.length}`;
  };

  window.addEventListener('search-result', (e) => {
    if (!SEARCH_RESULT) {
      addClass(searchPrev, 'disabled');
      addClass(searchNext, 'disabled');
      searchResult.textContent = `0/0`;
    } else {
      addClass(searchPrev, 'disabled');
      removeClass(searchNext, 'disabled');
      updateResult();
    }
  });

  searchPrev.addEventListener('click', () => {
    if (
      !SEARCH_RESULT ||
      indexSearch == 0 ||
      searchPrev.classList.contains('disabled')
    )
      return;

    indexSearch -= 1;

    if (indexSearch <= 0) {
      addClass(searchPrev, 'disabled');
    } else {
      removeClass(searchNext, 'disabled');
    }
    updateResult();
  });

  searchNext.addEventListener('click', () => {
    if (
      !SEARCH_RESULT ||
      indexSearch == SEARCH_RESULT.matches.length - 1 ||
      searchNext.classList.contains('disabled')
    )
      return;

    indexSearch += 1;

    if (indexSearch >= SEARCH_RESULT.matches.length - 1) {
      addClass(searchNext, 'disabled');
    } else {
      removeClass(searchPrev, 'disabled');
    }
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
      searchContainer && searchContainer.classList.remove('active');
    });

  handleSearch();

  searcPerform(SEARCH_QUERY ? SEARCH_QUERY.term : undefined);

  searchOpen && searchOpen.addEventListener('click', () => openSearchModal());
}

export function openSearchModal() {
  window.parent.dispatchEvent(new Event('open-search-modal'));
}

export function searcPerform(term) {
  if (!term) {
    setSearchResult(null);
    return;
  }
}
