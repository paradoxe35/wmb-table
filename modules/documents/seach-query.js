import { CHILD_WINDOW_EVENT } from '../shared/shared.js';

/**
 * @type { import('@localtypes/index').DocumentViewQuery | null }
 */
export let SEARCH_QUERY = null;

/**
 * @param {import("@localtypes/index").DocumentViewQuery | null} data
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
 * @type { { term: string; matches: import('@localtypes/index').SearchMatchersValue[]} | null }
 */
export let SEARCH_RESULT = null;

/**
 * @param { { term: string; textContentLength: number; matches: import('@localtypes/index').SearchMatchersValue[]} | null } data
 */
export function setSearchResult(data) {
  SEARCH_RESULT = data;
  window.dispatchEvent(
    new CustomEvent(CHILD_WINDOW_EVENT.searchResult, { detail: data })
  );
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

export let WINDOW_ZOOM = {
  $value: 100,
  get value() {
    return this.$value;
  },
  set value(val) {
    this.$value = val;
    this.valueListener(val);
  },
  valueListener(/** @type {any} */ _val) {},
  /**
   * @param {(_val: any) => void} fn
   */
  registerNewListener(fn) {
    this.valueListener = fn;
  },
};

/**
 * @param {number} data
 */
export function setWindowZoom(data) {
  WINDOW_ZOOM.value = data;
}

/**
 * @type {import("@localtypes/index").Title | null}
 */
export let DOCUMENT_TITLE_DATAS = null;

/**
 * @param {import("@localtypes/index").Title<string | null, string> | null} data
 */
export function setDocumentTitleData(data) {
  DOCUMENT_TITLE_DATAS = data;
}
