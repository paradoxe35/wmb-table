/**
 * @type { import('../../types/index').DocumentViewQuery }
 */
export let SEARCH_QUERY = null;

export function setSearchQuery(data) {
  SEARCH_QUERY = data;
}

/**
 * @type { { term: string; matches: import('../../types/index').SearchMatchersValue[]} }
 */
export let SEARCH_RESULT = null;

export function setSearchResult(data) {
  SEARCH_RESULT = data;
  window.dispatchEvent(new CustomEvent('search-result', { detail: data }));
}
