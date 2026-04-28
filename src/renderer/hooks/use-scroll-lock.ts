import { useEffect, useRef } from 'react';

export function useScrollLock(
    containerRef: React.RefObject<HTMLElement | null>,
    isLocked: boolean,
) {
    const lockPosRef = useRef<number>(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isLocked) return;

        // 1. Capture current position
        lockPosRef.current = container.scrollTop;

        // 2. Prevent input events (Stops the "flicker" before it happens)
        const preventInput = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const preventKeys = (e: KeyboardEvent) => {
            const keys = [' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
            if (keys.includes(e.key)) {
                e.preventDefault();
            }
        };

        // 3. Fallback snap-back (In case scroll is triggered by other means)
        const handleScroll = () => {
            if (container.scrollTop !== lockPosRef.current) {
                container.scrollTop = lockPosRef.current;
            }
        };

        container.addEventListener('wheel', preventInput, { passive: false });
        container.addEventListener('touchmove', preventInput, { passive: false });
        container.addEventListener('scroll', handleScroll);
        window.addEventListener('keydown', preventKeys, { passive: false });

        return () => {
            container.removeEventListener('wheel', preventInput);
            container.removeEventListener('touchmove', preventInput);
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', preventKeys);
        };
    }, [containerRef, isLocked]);
}
