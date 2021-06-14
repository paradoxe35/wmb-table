/**
 * @type { import('../../types/index').DocumentViewQuery }
 */
export let SEARCH_QUERY = null;

export function setSearchQuery(data) {
  SEARCH_QUERY = data;
}

export function setSearchQueryTerm(term) {
  if (SEARCH_QUERY) {
    SEARCH_QUERY.term = term;
  }
}

/**
 * @type { { term: string; matches: import('../../types/index').SearchMatchersValue[]} }
 */
export let SEARCH_RESULT = null;

/**
 * @param { { term: string; matches: import('../../types/index').SearchMatchersValue[]} } data
 */
export function setSearchResult(data) {
  SEARCH_RESULT = data;
  window.dispatchEvent(new CustomEvent('search-result', { detail: data }));
}

/**
 * @type { { top: number | undefined, left: number | undefined } }
 */
export let WINDOW_POSITION = null;

export function setWindowPostion(data) {
  WINDOW_POSITION = data;
}
