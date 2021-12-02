import { getChildByTreeArr, closestChildParent } from './functions.js';

const TEXT_NODE_NAME = '#text';
/**
 *
 * @param {HTMLElement} container
 */
export function cleanMarkTags(container = document.body) {
  Array.from(container.querySelectorAll('[data-mark-id]')).forEach((el) => {
    let textContent = el.textContent;

    let sibling = null;
    // always merge next sibling element with the current node
    while (el.nextSibling && el.nextSibling.nodeName === TEXT_NODE_NAME) {
      sibling = el.nextSibling;
      textContent += sibling.textContent || '';
      sibling.parentNode?.removeChild(sibling);
    }
    // always merge previous sibling element with the current node
    while (
      el.previousSibling &&
      el.previousSibling.nodeName === TEXT_NODE_NAME
    ) {
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
   * @param {boolean} force
   */
  const surroundChildContents = (
    element,
    startOffset,
    endOffset,
    force = false
  ) => {
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
      if (node.nodeName !== TEXT_NODE_NAME && firstCheck) {
        continue;
      }

      // @ts-ignore
      textLength += node.length;

      const range = document.createRange();

      if (textLength >= startOffset && firstCheck) {
        range.setStart(node, startOffset);
        range.setEnd(
          node,
          // @ts-ignore
          textLength >= endOffset && !force ? endOffset : node.length
        );
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
        range.setEnd(node, restLength > node.length ? node.length : restLength);
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
    surroundChildContents(
      startContainer,
      ranges.startOffset,
      ranges.endOffset,
      ranges.endOffset === 0
    );
    scrollIntoView();
    return;
  }

  if (!ranges.startToEndPath) return;

  const path = ranges.startToEndPath;

  /**
   *
   * @param {Node} node
   * @returns {number}
   */
  const getTextContentLength = (node) => {
    return node.nodeName === TEXT_NODE_NAME
      ? // @ts-ignore
        node?.length || 0
      : node.textContent?.length || 0;
  };

  path
    .map((tree) => getChildByTreeArr(tree))
    .forEach((treeEl) => {
      if (treeEl === startContainer) {
        surroundChildContents(
          treeEl,
          ranges.startOffset,
          getTextContentLength(treeEl)
        );
      } else if (treeEl === endContainer) {
        surroundChildContents(treeEl, 0, ranges.endOffset);
      } else {
        surroundChildContents(treeEl, 0, getTextContentLength(treeEl));
      }
    });

  scrollIntoView();
}

/**
 * get path from start container element to end container element
 *
 * @param {number[]} startCTree
 * @param {number[]} endCTree
 */
function startContainerToEndContainerPath(startCTree, endCTree) {
  const parentTree = [];
  let lastIndex = 0;

  for (let index = 0; index < startCTree.length; index++) {
    const sv = startCTree[index];
    lastIndex = index;

    if (endCTree[index] !== sv) break;
    parentTree.push(sv);
  }

  const path = [startCTree];

  if (
    startCTree[lastIndex] === undefined ||
    !endCTree[lastIndex] === undefined ||
    startCTree[lastIndex] > endCTree[lastIndex]
  ) {
    return null;
  }

  const distance = endCTree[lastIndex] - startCTree[lastIndex] - 1;

  if (distance > 0) {
    new Array(distance).fill(null).forEach((_, i) => {
      const newArr = startCTree.slice(0, lastIndex);
      newArr.push(startCTree[lastIndex] + (i + 1));
      path.push(newArr);
    });
  }

  path.push(endCTree);

  return [...path];
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
    startContainer.nodeName !== TEXT_NODE_NAME &&
    endContainer.nodeName !== TEXT_NODE_NAME
  ) {
    return null;
  }

  let startOffset = range.startOffset;
  let endOffset = range.endOffset;

  if (endContainer.nodeName !== TEXT_NODE_NAME) {
    endContainer = startContainer;
  } else if (startContainer.nodeName !== TEXT_NODE_NAME) {
    startContainer = endContainer;
  }

  if ((endContainer.textContent?.length || 0) === startOffset) {
    startOffset = startOffset - 1;
  }

  // get containers in tree from body element
  const startContainerTree = closestChildParent(startContainer);
  const endContainerTree = closestChildParent(endContainer);

  if (!startContainerTree || !endContainerTree) return null;

  const startToEndPath = startContainerToEndContainerPath(
    startContainerTree,
    endContainerTree
  );

  // get contextuel text here
  let textStartContainer = startContainer.textContent;
  if (!textStartContainer) return null;

  // get the startContainer text start from selected text position
  textStartContainer = textStartContainer.slice(
    startOffset,
    textStartContainer.length
  );

  /**
   * if next sibling doent not exist then go back up to parent and see if he has a sibling
   *
   * @type {Node | HTMLElement | null}
   */
  let containerForText = startContainer;

  if (!containerForText.nextSibling) {
    containerForText = startContainer.parentElement;
  }

  if (textStartContainer.length < 400 && containerForText?.nextSibling) {
    /**
     * @type { Node | null}
     */
    let cloneStartContainer = containerForText;

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
    startOffset: startOffset,
    endOffset: endOffset,
    startToEndPath: startToEndPath,
    contextualText: textStartContainer,
  };
}
