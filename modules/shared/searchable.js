/**
 *
 * @param {string | RegExp} pattern
 * @param {string} headstack
 * @returns {import('@localtypes/index').SearchMatchersValue[]}
 */
export function regexpMatcher(pattern, headstack) {
  const regexp = new RegExp(
    typeof pattern === 'string'
      ? pattern.replace(/[\'|\’]/g, "['’]").replace(/(œ|oe)/g, '(œ|oe)')
      : pattern,
    'gi'
  );
  const matches = [...headstack.matchAll(regexp)];

  return matches.map((match, i) => ({
    term: match[0],
    index: i + 1,
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
 *
 * @param {string} term
 * @returns
 */
export const simpleRegExp = (term) => {
  return new RegExp(
    strNormalize(escapeRegExp(term))
      .replace(/[\'|\’]/g, "['’]")
      .replace(/(œ|oe)/g, '(œ|oe)'),
    'gi'
  );
};

/**
 * @param {string} text
 */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} term
 */
export function toSearchableTerms(term) {
  let terms = strNormalizeNoLower(escapeRegExp(term.trim()))
    .split(' ')
    .filter(Boolean)
    .join(`[a-zA-Z]*([^\s+]*)?`);
  return `${terms}[a-zA-Z]*`;
}

/**
 *
 * @param {string} needle
 * @param {string} headstack
 * @returns
 */
export function performSearch(needle, headstack) {
  const terms = toSearchableTerms(needle);

  return regexpMatcher(terms, headstack);
}

/**
 *
 * @param {string} str
 * @returns
 */
export function strNormalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/**
 * @param {Node} node
 * @param {string | undefined} index
 * @param {number} start
 * @param {number} end
 */
export function surroundContentsTag(node, index, start, end) {
  let range = document.createRange();
  let tag = document.createElement('mark');

  tag.dataset.markId = index;
  range.setStart(node, start);
  range.setEnd(node, end);
  range.surroundContents(tag);

  return range;
}
