import { useEffect, useRef } from 'react';

export function resizeByHeiht<T>(
  containerRef: React.MutableRefObject<T | null>,
  susDiff: number
) {
  return function () {
    if (containerRef.current) {
      const winHeight = window.innerHeight;
      //@ts-ignore
      const { top } = containerRef.current.getBoundingClientRect();

      const diff = winHeight - top;
      if (diff > 0) {
        //@ts-ignore
        containerRef.current.style.height = `${diff - susDiff}px`;
        if (containerRef.current instanceof HTMLIFrameElement) {
          containerRef.current.height = `${diff - susDiff}`;
        }
      }
    }
  };
}

export function useValueStateRef<T>(value: T) {
  const ref = useRef<T>(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

export function useContainerScrollY<T>(
  resizers = [window],
  susDiff = 0,
  timeout: boolean = false
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const rebuildEl = resizeByHeiht(containerRef, susDiff);

    timeout
      ? window.setTimeout(rebuildEl, 500)
      : requestAnimationFrame(rebuildEl);
    window.addEventListener('load', rebuildEl);

    resizers.forEach((w) => w.addEventListener('resize', rebuildEl));

    return () => {
      resizers.forEach((w) => w.removeEventListener('resize', rebuildEl));
      window.removeEventListener('load', rebuildEl);
    };
  }, []);

  return containerRef;
}
