import {
  searchTemplateHtml,
  searchTemplateCss,
  injectStyleText,
} from './html.js';

import { SEARCH_RESULT, SEARCH_QUERY } from './seach-query.js';
import { performSearch } from './peform-search.js';

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

  let indexSearch = 1;

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
      if (indexSearch == SEARCH_RESULT.matches.length) {
        addClass(searchNext, 'disabled');
      } else {
        removeClass(searchNext, 'disabled');
      }
      updateResult();
    }
  });

  searchPrev.addEventListener('click', () => {
    if (searchPrev.classList.contains('disabled')) return;

    indexSearch -= 1;

    if (indexSearch <= 1) {
      addClass(searchPrev, 'disabled');
    }

    if (indexSearch < SEARCH_RESULT.matches.length) {
      removeClass(searchNext, 'disabled');
    }

    updateResult();
  });

  searchNext.addEventListener('click', () => {
    if (searchNext.classList.contains('disabled')) return;

    indexSearch += 1;

    if (indexSearch == SEARCH_RESULT.matches.length) {
      addClass(searchNext, 'disabled');
    }

    if (indexSearch > 1) {
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

  performSearch(SEARCH_QUERY ? SEARCH_QUERY.term : undefined);

  searchOpen && searchOpen.addEventListener('click', () => openSearchModal());
}

export function openSearchModal() {
  window.parent.dispatchEvent(new Event('open-search-modal'));
}
