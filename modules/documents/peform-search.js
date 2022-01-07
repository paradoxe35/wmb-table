import {
  escapeRegExp,
  regexpMatcher,
  strNormalizeNoLower,
  surroundContentsTag,
  toSearchableTerms,
} from '../shared/searchable.js';
import {
  CHILD_PARENT_WINDOW_EVENT,
  CHILD_WINDOW_EVENT,
  DOCUMENT_CONTENT_ID,
  PARENT_WINDOW_EVENT,
} from '../shared/shared.js';
import { createTreeTextWalker } from './document-tree.js';
import { pageContainer } from './functions.js';
import { setSearchResult } from './seach-query.js';

/**
 * @param {string | null | undefined} term
 */

/**
 * @param {import("@localtypes/index").DocumentViewQuery | null | undefined} query
 */
export function performDocumentSearch(query) {
  /** @type {HTMLElement} */
  const container =
    document.querySelector(`.${DOCUMENT_CONTENT_ID}`) || pageContainer();

  setSearchResult(null);
  if (!query) return;

  window.parent.dispatchEvent(
    new Event(PARENT_WINDOW_EVENT.frameDocumentSearchStart)
  );

  /** @type {string} */
  let term = query.term;

  /** @type {number} */
  let textContentLength = query.textContentLength;

  let matches = query.matches;

  if (query.matches.length === 0) {
    let textContent = strNormalizeNoLower(container.textContent);
    let terms;

    if (query.searchForParagraph) {
      terms = `\\n${escapeRegExp(term.trim())}(\\.?)\\s`;
    } else {
      terms = toSearchableTerms(term);
    }

    matches = regexpMatcher(terms, textContent);

    if (matches.length === 0) {
      window.parent.dispatchEvent(
        new Event(CHILD_PARENT_WINDOW_EVENT.emptySearchquery)
      );
    }

    // only first match for paragraph search
    matches =
      query.searchForParagraph && matches.length > 0 ? [matches[0]] : matches;

    textContentLength = textContent.length;
  }

  setSearchResult({ term, matches, textContentLength });

  markMaches(container, matches, textContentLength);

  // close query search for paragraph search
  if (query.searchForParagraph) {
    window.parent.dispatchEvent(
      new Event(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery)
    );
  }

  // inform parent that search ends
  window.parent.dispatchEvent(
    new Event(PARENT_WINDOW_EVENT.frameDocumentSearchEnd)
  );

  // resultConstructed event
  window.setTimeout(
    () => window.dispatchEvent(new Event(CHILD_WINDOW_EVENT.resultConstructed)),
    500
  );
}

/**
 * @param {HTMLElement} element
 * @param {import('@localtypes/index').SearchMatchersValue[]} matches
 * @param { number } textContentLength
 */
function markMaches(element, matches, textContentLength) {
  const walker = createTreeTextWalker(element);

  let index = 0;
  let node = null;

  let matchers = [...matches];

  let restLength = null;
  /**
   * @type {string | null | undefined}
   */
  let restIndex = null;
  let restTerm = null;

  let formTerm = '';

  let nodes = [];

  const resetField = () => {
    nodes = [];
    formTerm = '';
    restTerm = null;
    restIndex = null;
    restLength = null;
  };

  while ((node = walker.nextNode())) {
    if (restIndex && restTerm && restLength) {
      let crange = document.createRange();

      crange.setStart(node, 0);

      // @ts-ignore
      crange.setEnd(node, restLength > node.length ? node.length : restLength);

      formTerm += strNormalizeNoLower(crange.toString());

      // @ts-ignore
      if (formTerm === restTerm && restLength <= node.length) {
        nodes.forEach((nwNode) => {
          // @ts-ignore
          surroundContentsTag(nwNode.node, restIndex, nwNode.start, nwNode.end);
          walker.previousNode();
        });

        surroundContentsTag(node, restIndex, 0, restLength);

        // @ts-ignore
        matchers = matchers.filter((r) => restIndex != r.index);

        resetField();
      } else {
        // @ts-ignore
        if (restTerm.startsWith(formTerm) && restLength > node.length) {
          // @ts-ignore
          nodes.push({ node, start: 0, end: node.length });

          // @ts-ignore
          restLength -= node.length;

          continue;
        } else {
          resetField();
        }
      }
    }

    for (const matcher of matchers) {
      // @ts-ignore
      if (matcher.start >= index && matcher.end <= index + node.length) {
        try {
          surroundContentsTag(
            node,
            // @ts-ignore
            matcher.index,
            // @ts-ignore
            matcher.start - index,
            // @ts-ignore
            matcher.end - index
          );
          // walker.nextNode();
        } catch (error) {}

        // @ts-ignore
        matchers = matchers.filter((r) => matcher.index != r.index);
      } else if (
        // @ts-ignore
        matcher.start >= index &&
        // @ts-ignore
        matcher.end >= index + node.length &&
        // @ts-ignore
        matcher.start - index <= node.length
      ) {
        // @ts-ignore
        const start = matcher.start - index;
        // @ts-ignore
        const end = node.length;

        let crange = document.createRange();
        crange.setStart(node, start);
        crange.setEnd(node, end);

        let crangeText = strNormalizeNoLower(crange.toString());

        if (matcher.term.startsWith(crangeText)) {
          restLength = matcher.term.length - crangeText.length;
          restTerm = matcher.term;
          // @ts-ignore
          restIndex = matcher.index;

          formTerm = '';
          formTerm += crangeText;

          nodes = [];
          nodes.push({ node, start, end });
        }
      }
    }

    if (!matchers.length || index >= textContentLength) {
      break;
    }

    // @ts-ignore
    index += node.length;
  }
}
