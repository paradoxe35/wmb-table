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
