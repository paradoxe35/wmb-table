import React, { useEffect, useRef } from 'react';
import { debounce, respondToVisibility } from '@root/utils/functions';

const ScrollContainerMemo: React.FC = function ({ children }) {
  const lastScroll = useRef(0);
  const targetElement = useRef<HTMLElement | undefined>();
  const visibility = useRef(false);

  useEffect(() => {
    const contentLayoutEl = document.querySelector(
      '.site-layout-content'
    ) as HTMLElement | null;

    let unobserve: { (): any; (): void } | null = null;

    const saveComponentScroll = () => {
      if (visibility.current) {
        lastScroll.current = (contentLayoutEl as HTMLElement).scrollTop;
      }
    };

    if (contentLayoutEl && targetElement.current) {
      unobserve = respondToVisibility(targetElement.current, (isVisible) => {
        visibility.current = isVisible;

        isVisible &&
          contentLayoutEl.scrollTo({
            behavior: 'smooth',
            top: lastScroll.current,
          });
      });

      saveComponentScroll();
      contentLayoutEl.addEventListener(
        'scroll',
        debounce(saveComponentScroll, 500)
      );
    }

    return () => {
      contentLayoutEl &&
        contentLayoutEl.removeEventListener('scroll', saveComponentScroll);
      unobserve && unobserve();
    };
  }, []);

  return (
    <>{typeof children === 'function' ? children(targetElement) : children}</>
  );
};

export default ScrollContainerMemo;
