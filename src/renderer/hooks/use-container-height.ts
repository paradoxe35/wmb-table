import { useEffect, useRef } from 'react';

export function useContainerHeight<T extends HTMLElement>(susDiff = 0) {
    const containerRef = useRef<T | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const rebuild = () => {
            const winHeight = window.innerHeight;
            const { top } = el.getBoundingClientRect();
            const diff = winHeight - top;
            if (diff > 0) {
                el.style.height = `${diff - susDiff}px`;
            }
        };

        requestAnimationFrame(rebuild);
        window.addEventListener('resize', rebuild);

        return () => {
            window.removeEventListener('resize', rebuild);
        };
    }, [susDiff]);

    return containerRef;
}
