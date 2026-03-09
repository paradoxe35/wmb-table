import type { KeyboardEvent } from 'react';

export function interactiveProps(onClick: () => void) {
    return {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        },
    };
}
