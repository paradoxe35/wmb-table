export function debounce(callback: Function, delay: number) {
  let timer: NodeJS.Timeout;
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

export function getRandomInt(max: number, min: number = 0) {
  return Math.floor(Math.random() * (max - min + 1)) + min; // eslint-disable-line no-mixed-operators
}

export function array_move(
  arr: any[],
  old_index: number,
  new_index: number
): any[] {
  if (new_index >= arr.length) {
    var k = new_index - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
  return arr;
}

export function throttle(callback: Function, delay: number) {
  let last: number;
  let timer: NodeJS.Timeout;
  return function () {
    //@ts-ignore
    let context = this;
    let now = +new Date();
    let args = arguments;
    if (last && now < last + delay) {
      // le délai n'est pas écoulé on reset le timer
      clearTimeout(timer);
      timer = setTimeout(function () {
        last = now;
        callback.apply(context, args);
      }, delay);
    } else {
      last = now;
      callback.apply(context, args);
    }
  };
}

export function strNormalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function strNormalizeNoLower(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function eventListenOne(
  parent: null | Window | HTMLElement | Element,
  eventName: string,
  callback: Function
) {
  const el = parent || window;
  const h = (e: Event) => {
    callback(e);
    el.removeEventListener(eventName, h);
  };
  el.removeEventListener(eventName, h);
  el.addEventListener(eventName, h);
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function regexpMatcher(pattern: string | RegExp, headstack: string) {
  const regexp = new RegExp(pattern, 'gi');
  const matches = [...headstack.matchAll(regexp)];

  return matches.map((match) => ({
    term: match[0],
    start: match.index,
    end: match.index ? match.index + match[0].length : undefined,
  }));
}

export function injectStyleText(content: string) {
  const css = document.createElement('style');
  css.type = 'text/css';
  css.innerHTML = content;
  document.head.appendChild(css);
}

export function getDateTime(date?: Date) {
  date = date || new Date();
  const int = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: undefined,
  });
  return {
    date: capitalizeFirstLetter(int.format(date)),
    time: date.toTimeString().split(' ')[0],
  };
}

export const respondToVisibility = (
  element: Element,
  callback: (value: boolean) => void
) => {
  const options = {
    root: document.documentElement,
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      callback(entry.intersectionRatio > 0);
    });
  }, options);
  observer.observe(element);
  return () => observer.unobserve(element);
};
