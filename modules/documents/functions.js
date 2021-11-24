import { DOCUMENT_CONTAINER_ID } from '../shared/shared.js';

/**
 * @param { Node } element
 * @param { Node } parent
 */
export function closestChildParent(element, parent = document.body) {
  if (!parent || !element) return null;

  let child = element;
  const arr = [];

  while (child && child !== parent && child !== document.body) {
    // @ts-ignore
    arr.push(Array.prototype.indexOf.call(child.parentNode?.childNodes, child));
    // @ts-ignore
    child = child.parentNode;
  }

  return [...arr.reverse()];
}

/**
 * @param { Array<number> } arr
 * @param { Node} parent
 */
export function getChildByTreeArr(arr, parent = document.body) {
  // @ts-ignore
  let element = null;
  let lastEl = parent;
  arr.forEach((index) => {
    if (lastEl) {
      lastEl = lastEl.childNodes[index];
    }
  });
  return lastEl;
}

/**
 * @returns {HTMLElement }
 */
export function pageContainer() {
  // @ts-ignore
  return document.getElementById(DOCUMENT_CONTAINER_ID);
}

export function initBodyZoom(zoom = '100') {
  // @ts-ignore
  pageContainer().style.zoom = zoom + '%';
}

/**
 * @param {HTMLElement|null} [el]
 */
export function zoomIn(el) {
  const Page = el || pageContainer();
  // @ts-ignore
  const zoom = parseInt(Page.style.zoom) + 10;
  if (zoom >= 200) return false;
  // @ts-ignore
  Page.style.zoom = zoom + '%';
  return zoom;
}

/**
 * @param {HTMLElement|null} [el]
 */
export function zoomOut(el) {
  const Page = el || pageContainer();
  // @ts-ignore
  const zoom = parseInt(Page.style.zoom) - 10;
  if (zoom <= 10) return false;
  // @ts-ignore
  Page.style.zoom = zoom + '%';
  return zoom;
}

/**
 * @param {{ apply: (arg0: any, arg1: IArguments) => void; }} callback
 * @param {number} delay
 */
export function debounce(callback, delay) {
  /**
   * @type {NodeJS.Timeout}
   */
  let timer;
  return function () {
    let args = arguments;
    //@ts-ignore
    let context = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, delay);
  };
}
