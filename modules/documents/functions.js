/**
 * @param { HTMLElement | Element } element
 * @param { HTMLElement | Element } parent
 */
export function closestChildParent(element, parent) {
  if (!parent || !element) return null;

  let child = element;
  const arr = [];

  while (child && child !== parent && child !== document.body) {
    // @ts-ignore
    arr.push(Array.prototype.indexOf.call(child.parentElement.children, child));
    // @ts-ignore
    child = child.parentElement;
  }

  return [...arr.reverse()];
}

/**
 * @param { HTMLElement | Element } parent
 * @param { Array<number> } arr
 */
export function getChildByTreeArr(parent, arr) {
  // @ts-ignore
  let element = null;
  let lastEl = parent;
  arr.forEach((index) => {
    if (lastEl) {
      lastEl = lastEl.children[index];
    }
  });
  return lastEl;
}
