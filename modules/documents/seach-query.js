import { CHILD_WINDOW_EVENT } from '../shared/shared.js';

/**
 * @type {import('@localtypes/index').ProxyObjectFunction}
 */
const proxyObject = (value) => ({
  $value: value,
  get value() {
    return this.$value;
  },
  set value(val) {
    this.$value = val;
    this.valueListener(val);
  },
  valueListener(_val) {},
  registerNewListener(fn) {
    this.valueListener = fn;
  },
});

/**
 * @type { import('@localtypes/index').ProxyObjectFunctionValue<import('@localtypes/index').DocumentViewQuery | null> }
 */
export let SEARCH_QUERY = proxyObject(null);

/**
 * @param {import("@localtypes/index").DocumentViewQuery | null} data
 */
export function setSearchQuery(data) {
  SEARCH_QUERY.value = data;
}

/**
 * @param {string} term
 */
export function setSearchQueryTerm(term) {
  if (SEARCH_QUERY.value) {
    SEARCH_QUERY.value.term = term;
  }
}

/**
 * @type { import('@localtypes/index').ProxyObjectFunctionValue<{ term: string; matches: import('@localtypes/index').SearchMatchersValue[]} | null> }
 */
export let SEARCH_RESULT = proxyObject(null);

/**
 * @param { { term: string; textContentLength: number; matches: import('@localtypes/index').SearchMatchersValue[]} | null } data
 */
export function setSearchResult(data) {
  SEARCH_RESULT.value = data;
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

export let WINDOW_ZOOM = proxyObject(100);

/**
 * @param {number} data
 */
export function setWindowZoom(data) {
  WINDOW_ZOOM.value = data;
}

/**
 * @type { import('@localtypes/index').ProxyObjectFunctionValue<import("@localtypes/index").Title | null>}
 */
export let DOCUMENT_TITLE_DATAS = proxyObject(null);

/**
 * @param {import("@localtypes/index").Title<string | null, string> | null} data
 */
export function setDocumentTitleData(data) {
  DOCUMENT_TITLE_DATAS.value = data;
}

/**
 * @type { import('@localtypes/index').ProxyObjectFunctionValue<import("@localtypes/index").CurrentAudioDocumentPlay | null>}
 */
export let CURRENT_AUDIO_DOCUMENT_PLAY = proxyObject(null);

/**
 * @param {import("@localtypes/index").CurrentAudioDocumentPlay | null} data
 */
export function setCurrentAudioDocumentPlayData(data) {
  CURRENT_AUDIO_DOCUMENT_PLAY.value = data;
}

/**
 * @type { import('@localtypes/index').ProxyObjectFunctionValue<import("@localtypes/index").SubjectDocumentItem | null>}
 */
export let SUBJECT_NOTE_REFERENCE_POSISION = proxyObject(null);

/**
 * @param {import("@localtypes/index").SubjectDocumentItem | null} data
 */
export function setSubjectNoteReferencePosition(data) {
  SUBJECT_NOTE_REFERENCE_POSISION.value = data;
}
