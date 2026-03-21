import { useEffect, useRef } from 'react';
import { useAppStore } from '@renderer/stores';

export function useContainerHeight<T extends HTMLElement>(susDiff = 0) {
    const containerRef = useRef<T | null>(null);
    const readingMode = useAppStore((s) => s.readingMode);

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
    }, [susDiff, readingMode]);

    return containerRef;
}
