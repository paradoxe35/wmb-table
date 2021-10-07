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

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function regexpMatcher(pattern: string | RegExp, headstack: string) {
  const regexp = new RegExp(
    typeof pattern === 'string'
      ? pattern.replace(/[\'|\’]/g, "['’]").replace(/(œ|oe)/g, '(œ|oe)')
      : pattern,
    'gi'
  );
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
    milliseconds: date.getTime(),
  };
}

export const respondToVisibility = (
  element: Element | HTMLElement,
  callback: (value: boolean) => void
) => {
  const options = {
    root: document.documentElement,
  } as IntersectionObserverInit;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      callback(entry.intersectionRatio > 0);
    });
  }, options);
  observer.observe(element);
  return () => observer.unobserve(element);
};

export const substrAfter = (str: string, substr: string) => {
  return str.slice(str.indexOf(substr) + substr.length, str.length);
};

export function performSearch<T>(needle: string, headstack: string): T[] {
  const terms = strNormalizeNoLower(escapeRegExp(needle.trim()))
    .split(' ')
    .filter(Boolean)
    .join(`[a-z]*([^\s+]*)?`);

  return (regexpMatcher(`${terms}[a-z]*`, headstack) as unknown) as T[];
}

export const rafThrottle = (callback: Function) => {
  let requestId: number | null = null;

  let lastArgs: any[];

  const later = (context: any) => () => {
    requestId = null;
    callback.apply(context, lastArgs);
  };

  const throttled = function (...args: any[]) {
    lastArgs = args;
    if (requestId === null) {
      //@ts-ignore
      requestId = requestAnimationFrame(later(this));
    }
  };

  throttled.cancel = () => {
    cancelAnimationFrame(requestId as number);
    requestId = null;
  };

  return throttled;
};

export const kebabize = (str: string) => {
  return str
    .split('')
    .map((letter, idx) => {
      return letter.toUpperCase() === letter
        ? `${idx !== 0 ? '-' : ''}${letter.toLowerCase()}`
        : letter;
    })
    .join('');
};

export const camelCase = (str: string) => {
  return str
    .split(/[-_]/)
    .map((s, i) => (i === 0 ? s : capitalizeFirstLetter(s)))
    .join('');
};

export const getFilename = (path: string): string => {
  const splitted = path.split(/[\/\\]/);
  return splitted[splitted.length - 1];
};

/**
 *
 * @param promise
 * @returns
 */
export function cancellablePromise<T>(promise: Promise<T>) {
  let _resolve, _reject;

  let wrap: Promise<T> & {
    resolve?: (value: T) => void;
    reject?: (value: T) => void;
  } = new Promise<any>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
    promise.then(resolve).catch(reject);
  });
  wrap.resolve = _resolve;
  wrap.reject = _reject;

  return wrap;
}

export function trimBeforeDotAndComma(
  text: string = '',
  splitters: string[] = []
) {
  splitters.forEach((splitter) => {
    text = text
      .split(splitter)
      .map((d) => d.trimEnd())
      .join(splitter);
  });
  return text;
}

/**
 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
 *
 * @param  {number} seconds The number of seconds to be processed
 * @return {string}         The phrase describing the amount of time
 */
export function secondsforHumans(seconds: number | undefined) {
  if (seconds == undefined) return 0;
  seconds = Math.abs(seconds);
  const levels = [
    [Math.floor(seconds / 31536000), 'ans'],
    [Math.floor((seconds % 31536000) / 86400), 'jours'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'heurs'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 'secondes'],
  ];
  let returntext = '';

  for (let i = 0, max = levels.length; i < max; i++) {
    if (levels[i][0] === 0) continue;
    returntext +=
      ' ' +
      levels[i][0] +
      ' ' +
      (levels[i][0] === 1
        ? //@ts-ignore
          levels[i][1].substr(0, levels[i][1].length - 1)
        : levels[i][1]);
  }
  return returntext.trim();
}
