import { getChildByTreeArr, pageContainer } from './functions.js';

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
