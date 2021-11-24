import { getChildByTreeArr, closestChildParent } from './functions.js';

/**
 *
 * @param {HTMLElement} container
 */
export function cleanMarkTags(container = document.body) {
  Array.from(container.querySelectorAll('[data-mark-id]')).forEach((el) => {
    let textContent = el.textContent;

    let sibling = null;
    // always merge next sibling element with the current node
    while (el.nextSibling && el.nextSibling.nodeName === '#text') {
      sibling = el.nextSibling;
      textContent += sibling.textContent || '';
      sibling.parentNode?.removeChild(sibling);
    }
    // always merge previous sibling element with the current node
    while (el.previousSibling && el.previousSibling.nodeName === '#text') {
      sibling = el.previousSibling;
      textContent = (sibling.textContent || '') + textContent;
      sibling.parentNode?.removeChild(sibling);
    }

    const fragment = document
      .createRange()
      .createContextualFragment(textContent || '');

    el.parentNode?.replaceChild(fragment, el);
  });
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

  const startContainer = getChildByTreeArr(ranges.startContainer);
  const endContainer = getChildByTreeArr(ranges.endContainer);

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
   * @param { Node | null } element
   * @param {number} startOffset
   * @param {number} endOffset
   */
  const surroundChildContents = (element, startOffset, endOffset) => {
    if (!element) return;

    const walker = createTreeTextWalker(element);
    /**
     * @type { Node | null}
     */
    let node = element;
    if (!node) return;

    let textLength = 0;
    let restLength = endOffset;
    let firstCheck = true;

    do {
      // @ts-ignore
      if (node.nodeName !== '#text' && firstCheck) {
        continue;
      }

      // @ts-ignore
      textLength += node.length;

      const range = document.createRange();

      if (textLength >= startOffset && firstCheck) {
        range.setStart(node, startOffset);
        // @ts-ignore
        range.setEnd(node, textLength >= endOffset ? endOffset : node.length);
        firstCheck = false;
      } else if (
        (!firstCheck && textLength < endOffset) ||
        textLength < startOffset
      ) {
        range.setStart(node, 0);
        // @ts-ignore
        range.setEnd(node, node.length);
      } else if (!firstCheck && textLength >= endOffset) {
        range.setStart(node, 0);
        // @ts-ignore
        range.setEnd(node, restLength);
      }

      if (range.endOffset > 0) {
        range.surroundContents(markElement());
      }
      // @ts-ignore
      restLength -= node.length;

      if (textLength >= endOffset) {
        break;
      }
    } while ((node = walker.nextNode()));
  };

  if (startContainer === endContainer) {
    surroundChildContents(startContainer, ranges.startOffset, ranges.endOffset);
    scrollIntoView();
    return;
  }

  const exists =
    Array.prototype.indexOf.call(
      startContainer.parentNode?.childNodes,
      endContainer
    ) > -1;

  // simple
  if (!exists) {
    const exists =
      Array.prototype.indexOf.call(
        startContainer.parentElement?.parentElement?.children,
        endContainer.parentElement
      ) > -1;
    if (!exists) {
      surroundChildContents(
        startContainer,
        ranges.startOffset,
        // @ts-ignore
        startContainer?.length || 0
      );
      scrollIntoView();
      return;
    }
  }

  // if endContainer is doent exist in parent element of startContainer the
  // go back up to parentElememt x2 and work with elements
  if (!exists) {
    /** @type {Element | HTMLElement | null} */
    let nextElementSibling = startContainer.parentElement;

    surroundChildContents(
      nextElementSibling,
      ranges.startOffset,
      nextElementSibling?.textContent?.length || 0
    );

    while (
      nextElementSibling?.nextElementSibling &&
      nextElementSibling.nextElementSibling !== endContainer.parentElement
    ) {
      nextElementSibling = nextElementSibling.nextElementSibling;
      surroundChildContents(
        nextElementSibling,
        0,
        nextElementSibling.textContent?.length || 0
      );
    }

    if (nextElementSibling?.nextElementSibling === endContainer.parentElement) {
      surroundChildContents(endContainer.parentElement, 0, ranges.endOffset);
    }
  } else {
    // if exist just continious working textNodes
    let nextElementSibling = startContainer;

    surroundChildContents(
      nextElementSibling,
      ranges.startOffset,
      // @ts-ignore
      nextElementSibling?.length || 0
    );

    while (
      nextElementSibling.nextSibling &&
      nextElementSibling.nextSibling !== endContainer
    ) {
      nextElementSibling = nextElementSibling.nextSibling;
      surroundChildContents(
        nextElementSibling,
        0,
        // @ts-ignore
        nextElementSibling?.length || 0
      );
    }

    if (nextElementSibling.nextSibling === endContainer) {
      surroundChildContents(endContainer, 0, ranges.endOffset);
    }
  }

  scrollIntoView();
}

/**
 * Get selected text as reference
 * @returns {import('@localtypes/index').DocumentTreeRanges | null }
 */
export function selectedTextAsReference() {
  // get text selection
  let selection = window.getSelection();

  // get the range before mark tags clean
  const range1 = selection?.getRangeAt(0).cloneRange();
  const startOffset1 = range1?.startOffset;

  // first clean mark elements on the dom
  cleanMarkTags();

  // get range after and this will the default tag
  const range = selection?.getRangeAt(0).cloneRange();

  if (!selection || !range || selection.toString().trim().length < 1)
    return null;

  // get range containers
  let startContainer = range.startContainer;
  let endContainer = range.endContainer;

  // if the first range doent match the cancel the selection
  if (startOffset1 !== range.startOffset) {
    selection.removeAllRanges();
    return null;
  }

  // allow text note only
  if (
    startContainer.nodeName !== '#text' &&
    endContainer.nodeName !== '#text'
  ) {
    return null;
  }

  if (endContainer.nodeName !== '#text') {
    endContainer = startContainer;
  } else if (startContainer.nodeName !== '#text') {
    startContainer = endContainer;
  }

  // get containers in tree from body element
  const startContainerTree = closestChildParent(startContainer);
  const endContainerTree = closestChildParent(endContainer);

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
     * @type { Node | null}
     */
    let cloneStartContainer = startContainer;

    while (
      textStartContainer.length < 400 &&
      cloneStartContainer &&
      cloneStartContainer.nextSibling
    ) {
      textStartContainer += cloneStartContainer.nextSibling?.textContent || '';
      cloneStartContainer = cloneStartContainer.nextSibling;
    }
  }

  textStartContainer = textStartContainer.slice(0, 400);

  // if doent have 400 character add siblings element text

  return {
    startContainer: startContainerTree,
    endContainer: endContainerTree,
    startOffset: range.startOffset,
    // @ts-ignore
    startContainerTextLength: startContainer?.length || 0,
    // @ts-ignore
    endContainerTextLenth: endContainer?.length || 0,
    endOffset: range.endOffset,
    contextualText: textStartContainer,
  };
}
