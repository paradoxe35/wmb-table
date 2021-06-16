import { getChildByTreeArr } from './functions.js';

/**
 * @param { import('../../src/types').SubjectDocumentItem } item
 */
export function scrollToViewTree(item) {
  const element = getChildByTreeArr(document.body, item.documentHtmlTree);
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
