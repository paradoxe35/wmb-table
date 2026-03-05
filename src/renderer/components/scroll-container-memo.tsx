import React, { useEffect, useRef } from 'react';
import { debounce, respondToVisibility } from '@renderer/utils/functions';

const ScrollContainerMemo: React.FC<{
    children?:
        | React.ReactNode
        | ((ref: React.MutableRefObject<HTMLElement | undefined>) => React.ReactNode);
}> = function ({ children }) {
    const lastScroll = useRef(0);
    const targetElement = useRef<HTMLElement | undefined>(undefined);
    const visibility = useRef(false);

    useEffect(() => {
        const contentLayoutEl = document.querySelector(
            '.site-layout-content',
        ) as HTMLElement | null;

        let unobserve: (() => void) | null = null;

        const saveComponentScroll = () => {
            if (visibility.current && contentLayoutEl) {
                lastScroll.current = contentLayoutEl.scrollTop;
            }
        };

        if (contentLayoutEl && targetElement.current) {
            unobserve = respondToVisibility(targetElement.current, (isVisible) => {
                visibility.current = isVisible;
                if (isVisible) {
                    contentLayoutEl.scrollTo({ behavior: 'smooth', top: lastScroll.current });
                }
            });

            saveComponentScroll();
            contentLayoutEl.addEventListener(
                'scroll',
                debounce(saveComponentScroll, 500) as EventListener,
            );
        }

        return () => {
            contentLayoutEl?.removeEventListener('scroll', saveComponentScroll);
            unobserve?.();
        };
    }, []);

    return <>{typeof children === 'function' ? children(targetElement) : children}</>;
};

export default ScrollContainerMemo;
