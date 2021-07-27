import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { appViewStore, MAIN_VIEWS, optionViewStore } from '../store';
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
      const isVisibleEl = {
        value: true,
      };

      const rebuildEl = () => {
        if (!isVisibleEl.value) return;
        const winHeight = window.innerHeight;
        const {
          top,
        } = ((containerRef.current as unknown) as HTMLElement).getBoundingClientRect();

        const diff = winHeight - top;
        if (diff > 0) {
          ((containerRef.current as unknown) as HTMLElement).style.height = `${
            diff - susDiff
          }px`;
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
      unobserve = respondToVisibility(
        (containerRef.current as unknown) as Element,
        (isVisible) => {
          if (isVisible) {
            isVisibleEl.value = true;
            rebuildEl();
          } else {
            isVisibleEl.value = false;
          }
        }
      );

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

export function useDataStateRef<T>(datas: T) {
  const ref = useRef<T>();

  ref.current = useMemo(() => datas, [datas]);

  return ref;
}

export function useOptionsMenu() {
  const setDocumentViewer = useSetRecoilState(appViewStore);
  const setOptionViewer = useSetRecoilState(optionViewStore);

  const onClick = useCallback((option: string) => {
    setDocumentViewer(MAIN_VIEWS.options);
    setOptionViewer(option);
  }, []);

  return onClick;
}
