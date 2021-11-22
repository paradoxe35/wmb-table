import {
  getChildByTreeArr,
  pageContainer,
  closestChildParent,
} from './functions.js';

/**
 * @param { import('@localtypes/index').SubjectDocumentItem } item
 */
export function scrollToViewTree(item) {
  const element = getChildByTreeArr(document.body, item.documentHtmlTree.tree);
  const container = pageContainer();

  container.scrollTo({
    top: item.documentHtmlTree.scrollY,
    left: item.documentHtmlTree.scrollX,
    behavior: 'smooth',
  });

  if (element) {
    // @ts-ignore
    element.style.backgroundColor = '#57aeff';
    element.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'center',
    });
  }
}

/**
 * @param {Node} element
 * @returns
 */
export const createTreeTextWalker = (element) => {
  var nodeFilter = {
    acceptNode: function (/** @type {Node} */ node) {
      if (!node.nodeValue || !node.nodeValue.length) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  };

  return document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    nodeFilter,
    // @ts-ignore
    false
  );
};

/**
 *
 * @param { import('@localtypes/index').SubjectDocumentItem } item
 */
export function scrollToRangesTreeView(item) {
  const ranges = item.documentHtmlTree.ranges;
  if (!ranges) return;

  const bodyElement = document.body;

  const startContainer = getChildByTreeArr(bodyElement, ranges.startContainer);
  const endContainer = getChildByTreeArr(bodyElement, ranges.endContainer);

  let markElement = () => {
    const el = document.createElement('mark');
    el.style.backgroundColor = '#57aeff';
    el.setAttribute('data-mark-id', '1');
    return el;
  };

  const scrollIntoView = () => {
    document.querySelector('[data-mark-id]')?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'center',
    });
  };

  /**
   *
   * @param {HTMLElement | Element} element
   * @param {number} startOffset
   * @param {number} endOffset
   */
  const surroundChildContents = (element, startOffset, endOffset) => {
    const walker = createTreeTextWalker(element);
    let node = null;

    let textLength = 0;
    let restLength = endOffset;
    let firstCheck = true;

    while ((node = walker.nextNode())) {
      console.log(node);
      // @ts-ignore
      textLength += node.length;
      const range = document.createRange();

      if (textLength >= startOffset && firstCheck) {
        range.setStart(node, startOffset);
        // @ts-ignore
        range.setEnd(node, textLength >= endOffset ? endOffset : node.length);
        firstCheck = false;
        console.log('firstCheck');
      } else if (
        (!firstCheck && textLength < endOffset) ||
        textLength < startOffset
      ) {
        range.setStart(node, 0);
        // @ts-ignore
        range.setEnd(node, node.length);
        console.log('middle');
      } else if (!firstCheck && textLength >= endOffset) {
        range.setStart(node, 0);
        // @ts-ignore
        range.setEnd(node, restLength);
        console.log('end', restLength);
      }

      if (range.endOffset > 0) {
        range.surroundContents(markElement());
      }
      // @ts-ignore
      restLength -= node.length;

      if (textLength >= endOffset) {
        break;
      }
    }
  };

  console.log(startContainer);
  console.log(endContainer);

  console.log(ranges.startOffset, ranges.endOffset);

  if (startContainer === endContainer) {
    surroundChildContents(startContainer, ranges.startOffset, ranges.endOffset);
    scrollIntoView();
    return;
  }

  const exists =
    Array.prototype.indexOf.call(
      startContainer.parentElement?.children,
      endContainer
    ) > -1;

  if (!exists) {
    surroundChildContents(
      startContainer,
      ranges.startOffset,
      startContainer.textContent?.length || 0
    );
    scrollIntoView();
    return;
  }

  let nextElementSibling = startContainer;

  surroundChildContents(
    nextElementSibling,
    ranges.startOffset,
    nextElementSibling.textContent?.length || 0
  );

  while (
    nextElementSibling.nextElementSibling &&
    nextElementSibling.nextElementSibling !== endContainer
  ) {
    nextElementSibling = nextElementSibling.nextElementSibling;
    surroundChildContents(
      nextElementSibling,
      0,
      nextElementSibling.textContent?.length || 0
    );
  }

  if (nextElementSibling.nextElementSibling === endContainer) {
    surroundChildContents(endContainer, 0, ranges.endOffset);
  }
  scrollIntoView();
}

/**
 * Get selected text as reference
 * @returns {import('@localtypes/index').DocumentTreeRanges | null }
 */
export function selectedTextAsReference() {
  const selection = window.getSelection();
  if (!selection || selection.toString().trim().length < 1) return null;

  const range = selection.getRangeAt(0).cloneRange();

  /**
   * @returns {HTMLElement | null}
   */
  const tagContainer = (/** @type {Node} */ node) => {
    /**
     * @type {Node | HTMLElement | null}
     */
    let container = node;

    if (container.nodeName === '#text') {
      container = container.parentElement;
    }
    // @ts-ignore
    return container;
  };

  let startContainer = tagContainer(range.startContainer);
  let endContainer = tagContainer(range.endContainer);

  if (!startContainer || !endContainer) return null;

  const bodyElement = document.body;

  // get containers in tree from body element
  const startContainerTree = closestChildParent(startContainer, bodyElement);
  const endContainerTree = closestChildParent(endContainer, bodyElement);

  if (!startContainerTree || !endContainerTree) return null;

  // get contextuel text here
  let textStartContainer = startContainer.textContent;
  if (!textStartContainer) return null;

  // get the startContainer text start from selected text position
  textStartContainer = textStartContainer.slice(
    range.startOffset,
    textStartContainer.length
  );

  if (textStartContainer.length < 400 && startContainer.nextSibling) {
    /**
     * @type {HTMLElement | Element | null}
     */
    let cloneStartContainer = startContainer;

    while (
      textStartContainer.length < 400 &&
      cloneStartContainer &&
      cloneStartContainer.nextSibling
    ) {
      textStartContainer +=
        cloneStartContainer.nextElementSibling?.textContent || '';
      cloneStartContainer = cloneStartContainer.nextElementSibling;
    }
  }

  textStartContainer = textStartContainer.slice(0, 400);

  // if doent have 400 character add siblings element text

  return {
    startContainer: startContainerTree,
    endContainer: endContainerTree,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    contextualText: textStartContainer,
  };
}
