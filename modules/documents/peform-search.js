import { setSearchResult } from './seach-query.js';

/**
 * @param {string | null | undefined} term
 */
export function performSearch(term) {
  setSearchResult(null);
  if (!term) return;

  const textContent = strNormalizeNoLower(document.body.textContent);

  const terms = strNormalizeNoLower(term.trim())
    .split(' ')
    .filter(Boolean)
    .join(`[a-z]*([^\s+]*)?`);

  const matches = regexpMatcher(`${terms}[a-z]*`, textContent).map((m, i) => {
    //@ts-ignore
    m.index = i + 1;
    return m;
  });

  setSearchResult({ term, matches });

  markMaches(document.body, matches, textContent.length);
}

/**
 * @param {string | RegExp} pattern
 * @param {string} headstack
 * @returns {import('../../src/types/index').SearchMatchersValue[]}
 */
function regexpMatcher(pattern, headstack) {
  const regexp = new RegExp(pattern, 'gi');
  const matches = [...headstack.matchAll(regexp)];

  return matches.map((match) => ({
    term: match[0],
    start: match.index,
    end: match.index ? match.index + match[0].length : undefined,
  }));
}

/**
 * @param {string | null} str
 * @returns { string }
 */
export function strNormalizeNoLower(str) {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

/**
 * @param {Node} node
 * @param {string | undefined} index
 * @param {number} start
 * @param {number} end
 */
function surroundContentsTag(node, index, start, end) {
  let range = document.createRange();
  let tag = document.createElement('mark');

  tag.dataset.markId = index;
  range.setStart(node, start);
  range.setEnd(node, end);
  range.surroundContents(tag);

  return range;
}

/**
 * @param {HTMLElement} element
 * @param {import('../../src/types/index').SearchMatchersValue[]} matches
 * @param { number } textContentLength
 */
function markMaches(element, matches, textContentLength) {
  var nodeFilter = {
    acceptNode: function (/** @type {Node} */ node) {
      if (!node.nodeValue || !node.nodeValue.length) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  };

  let walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    nodeFilter,
    false
  );

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
  window.dispatchEvent(new Event('result-constructed'));
}
