/**
 * @type { import('../../types/index').DocumentViewQuery | null }
 */
export let SEARCH_QUERY = null;

/**
 * @param {import("../../types/index").DocumentViewQuery | null} data
 */
export function setSearchQuery(data) {
  SEARCH_QUERY = data;
}

/**
 * @param {string} term
 */
export function setSearchQueryTerm(term) {
  if (SEARCH_QUERY) {
    SEARCH_QUERY.term = term;
  }
}

/**
 * @type { { term: string; matches: import('../../types/index').SearchMatchersValue[]} | null }
 */
export let SEARCH_RESULT = null;

/**
 * @param { { term: string; matches: import('../../types/index').SearchMatchersValue[]} | null } data
 */
export function setSearchResult(data) {
  SEARCH_RESULT = data;
  window.dispatchEvent(new CustomEvent('search-result', { detail: data }));
}

/**
 * @type { { top: number | undefined, left: number | undefined } | null }
 */
export let WINDOW_POSITION = null;

/**
 * @param {{ top: number | undefined; left: number | undefined; } | null} data
 */
export function setWindowPostion(data) {
  WINDOW_POSITION = data;
}
