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

export function regexpMatcher(pattern: string | RegExp, headstack: string) {
  const regexp = new RegExp(pattern, 'gi');
  const matches = [...headstack.matchAll(regexp)];

  return matches.map((match) => ({
    term: match[0],
    start: match.index,
    end: match.index ? match.index + match[0].length : undefined,
  }));
}
