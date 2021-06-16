import { useEffect, useRef } from 'react';
import { respondToVisibility } from './functions';

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
    if (containerRef.current) {
      let hasWidth = 0;

      const rebuildEl = () => {
        const winHeight = window.innerHeight;
        //@ts-ignore
        const { top, width } = containerRef.current.getBoundingClientRect();
        if (hasWidth === width) return;
        hasWidth = width;

        const diff = winHeight - top;
        if (diff > 0) {
          //@ts-ignore
          containerRef.current.style.height = `${diff - susDiff}px`;
          if (containerRef.current instanceof HTMLIFrameElement) {
            containerRef.current.height = `${diff - susDiff}`;
          }
        }
      };

      timeout
        ? window.setTimeout(rebuildEl, 500)
        : requestAnimationFrame(rebuildEl);

      window.addEventListener('load', rebuildEl);

      resizers.forEach((w) => w.addEventListener('resize', rebuildEl));

      let unobserve: { (): any; (): void } | null = null;
      if (hasWidth === 0) {
        unobserve = respondToVisibility(
          (containerRef.current as unknown) as Element,
          (isVisible) => {
            if (hasWidth === 0 && isVisible) rebuildEl();
          }
        );
      }

      return () => {
        resizers.forEach((w) => w.removeEventListener('resize', rebuildEl));
        window.removeEventListener('load', rebuildEl);
        unobserve && unobserve();
      };
    }

    return () => {};
  }, []);

  return containerRef;
}
