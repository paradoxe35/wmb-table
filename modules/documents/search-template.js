import {
  SEARCH_RESULT,
  SEARCH_QUERY,
  WINDOW_ZOOM,
  DOCUMENT_TITLE_DATAS,
  CURRENT_AUDIO_DOCUMENT_PLAY,
  SUBJECT_NOTE_REFERENCE_POSISION,
} from './seach-query.js';
import { performDocumentSearch } from './peform-search.js';
import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
} from '../shared/shared.js';
import { pageContainer } from './functions.js';
import { handleZoomIn, handleZoomOut } from './context-menu.js';
import { pauseIcon, playIcon } from './html.js';
import { cleanMarkTags } from './document-tree.js';

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
 * @type {{  value: null | number }}
 */
let lastIndex = {
  value: null,
};

/**
 * @param {number | null} index
 */
function navigateOnResult(index) {
  if (index == lastIndex.value) return;

  if (lastIndex.value) {
    /** @type { HTMLElement[] } */
    // @ts-ignore
    const pMarks = document.querySelectorAll(
      `mark[data-mark-id="${lastIndex.value}"]`
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
    lastIndex.value = index;
  }
}

export function handleSearch() {
  const searchPrev = document.querySelector('.search--prev--js');
  const searchNext = document.querySelector('.search--next--js');
  const searchResult = document.querySelector('.search--result--js');

  let indexSearch = {
    value: 1,
  };

  const updateResult = () => {
    if (!searchResult) return;
    searchResult.textContent = `${indexSearch.value}/${
      SEARCH_RESULT.value ? SEARCH_RESULT.value.matches.length : 0
    }`;
  };

  // listen for search result
  window.addEventListener(CHILD_WINDOW_EVENT.searchResult, (_e) => {
    if (!SEARCH_RESULT.value || SEARCH_RESULT.value.matches.length < 1) {
      indexSearch.value = 0;
    } else {
      indexSearch.value = 1;
    }
    if (!SEARCH_RESULT.value) {
      addClass(searchPrev, 'disabled');
      addClass(searchNext, 'disabled');
      // @ts-ignore
      searchResult.textContent = `0/0`;
    } else {
      addClass(searchPrev, 'disabled');
      if (indexSearch.value == SEARCH_RESULT.value.matches.length) {
        addClass(searchNext, 'disabled');
      } else {
        removeClass(searchNext, 'disabled');
      }
      lastIndex.value = null;

      updateResult();
    }
  });

  // listen for result has been construct in dom
  window.addEventListener(CHILD_WINDOW_EVENT.resultConstructed, () => {
    navigateOnResult(indexSearch.value);
  });

  // listen on previous result
  searchPrev &&
    searchPrev.addEventListener('click', () => {
      if (searchPrev.classList.contains('disabled') || !SEARCH_RESULT.value)
        return;

      indexSearch.value -= 1;

      if (indexSearch.value <= 1) {
        addClass(searchPrev, 'disabled');
      }

      if (indexSearch.value < SEARCH_RESULT.value.matches.length) {
        removeClass(searchNext, 'disabled');
      }

      navigateOnResult(indexSearch.value);

      updateResult();
    });

  //  listen for next result
  searchNext &&
    searchNext.addEventListener('click', () => {
      if (searchNext.classList.contains('disabled') || !SEARCH_RESULT.value)
        return;

      indexSearch.value += 1;

      if (indexSearch.value == SEARCH_RESULT.value.matches.length) {
        addClass(searchNext, 'disabled');
      }

      if (indexSearch.value > 1) {
        removeClass(searchPrev, 'disabled');
      }

      navigateOnResult(indexSearch.value);

      updateResult();
    });
}

/**
 * the previous event callback of searchClose element
 *
 * @type { {value: null | ((e: Event) => void)} }
 */
let cancelableDocumentSeachable = {
  value: null,
};

/**
 *
 * @param {Function | undefined} callback
 */
function cancelDocumentSeachableResults(callback = undefined) {
  const seperator = document.querySelector('.search--separator');
  const searchClose = document.querySelector('.search--close--js');

  seperator?.classList.remove('display-none');
  searchClose?.classList.remove('display-none');

  // clean up the previous listener to avoid multiple event emission
  if (cancelableDocumentSeachable.value) {
    searchClose?.removeEventListener(
      'click',
      cancelableDocumentSeachable.value
    );
  }

  // callback function
  cancelableDocumentSeachable.value = () => {
    cleanMarkTags(container);

    seperator?.classList.add('display-none');
    searchClose?.classList.add('display-none');

    callback && callback();

    window.parent.dispatchEvent(
      new Event(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery)
    );
  };

  searchClose?.addEventListener('click', cancelableDocumentSeachable.value);

  return searchClose;
}

/**
 * init search template
 */
export default function initSearchableTemplate() {
  const searchField = Array.from(document.querySelectorAll('.search--field'));
  cancelDocumentSeachableResults(() => {
    searchField.forEach((el) => {
      !el.classList.contains('display-none') &&
        el.classList.add('display-none');
    });
  });

  // show seach fields
  searchField.forEach((el) => el.classList.remove('display-none'));

  handleSearch();

  performDocumentSearch(SEARCH_QUERY.value ? SEARCH_QUERY.value : undefined);
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

function openSearchModal(searchForParagraph = false) {
  let text = null;

  const selection = window.getSelection()
    ? // @ts-ignore
      window.getSelection().toString().trim()
    : null;
  if (selection && selection.length > 1 && selection.length <= 80) {
    text = selection;
  }

  /** @type { import('@localtypes/index').DocumentSearchEvent } */
  const detail = {
    searchForParagraph,
    text,
  };

  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.openSearchModal, { detail })
  );
}

/**
 * search modal handler
 */
function searchModalHandler() {
  // open search modal
  document
    ?.querySelector('.search--open--js')
    ?.addEventListener('click', () => openSearchModal());

  // open search from event listener
  window.addEventListener(CHILD_WINDOW_EVENT.searchOpen, () =>
    openSearchModal()
  );
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
 * document other traductions handler
 */
function handleOtherTraductions() {
  window.parent.dispatchEvent(
    new Event(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal)
  );
}

/**
 * document pdf donwload
 */
function handlePdfDownload() {
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.downloadDocumentPdf, {
      detail: DOCUMENT_TITLE_DATAS.value,
    })
  );
}

/**
 * audio document play
 */
function handleAudioDocumentPlay() {
  window.parent.dispatchEvent(
    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
      detail: DOCUMENT_TITLE_DATAS.value,
    })
  );
}

/**
 * @param {import("@localtypes/index").Title<string | null, string> | null} data
 */
function documentTitleDataHandler(data) {
  if (!data || !DOCUMENT_TITLE_DATAS.value) return;

  // -------------- section external -----
  const seperatorExternal = document.querySelector(
    '.document-external-field-separator'
  );
  if (
    DOCUMENT_TITLE_DATAS.value.web_link ||
    DOCUMENT_TITLE_DATAS.value.pdf_link
  ) {
    seperatorExternal?.classList.remove('display-none');
  }

  // handle document external links when clicked
  if (DOCUMENT_TITLE_DATAS.value.web_link) {
    const web_link = document.querySelector('.search--web-link--js');
    web_link?.classList.remove('display-none');
    web_link?.addEventListener('click', handleDocumentExternalWebLink);
  }

  // handle pdf download
  if (DOCUMENT_TITLE_DATAS.value.pdf_link) {
    const pdf_link = document.querySelector('.search--pdf-download--js');
    pdf_link?.classList.remove('display-none');
    pdf_link?.addEventListener('click', handlePdfDownload);
  }
  // -------------- section external -----

  // -------------- section audio and traductions handler -----
  const seperatorDrive = document.querySelector(
    '.document-drive-field-separator'
  );
  if (
    DOCUMENT_TITLE_DATAS.value.other_traductions.length > 0 ||
    DOCUMENT_TITLE_DATAS.value.audio_link
  ) {
    seperatorDrive?.classList.remove('display-none');
  }
  // handle other traductions
  if (DOCUMENT_TITLE_DATAS.value.other_traductions.length > 0) {
    const transEl = document.querySelector('.search--other-traduction--js');
    transEl?.classList.remove('display-none');
    transEl?.addEventListener('click', handleOtherTraductions);
  }
  // handle audio document
  if (DOCUMENT_TITLE_DATAS.value.audio_link) {
    const audioEl = document.querySelector('.search--audio-document--js');
    audioEl?.classList.remove('display-none');
    audioEl?.addEventListener('click', handleAudioDocumentPlay);
  }
  // -------------- section audio and traductions handler -----
}

DOCUMENT_TITLE_DATAS.registerNewListener(documentTitleDataHandler);

// handle audio play status
CURRENT_AUDIO_DOCUMENT_PLAY.registerNewListener((value) => {
  const audioEl = document.querySelector('.search--audio-document--js');
  if (!value || !audioEl) return;

  if (value.status === 'play') {
    audioEl.innerHTML = pauseIcon;
  } else {
    audioEl.innerHTML = playIcon;
  }
});

// handle search for paragraph
document
  .querySelector('.search--paragraph--js')
  ?.addEventListener('click', () => openSearchModal(true));

// hanle subject note refence position
// by show searchClose element to cancel reference result
SUBJECT_NOTE_REFERENCE_POSISION.registerNewListener(() => {
  cancelDocumentSeachableResults();
});
