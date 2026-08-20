export { debounce, throttle, capitalize as capitalizeFirstLetter } from 'lodash';

const REMOTE_ERROR_PATTERNS = [
    /^Error invoking remote (?:method|function)\s+['"].*?['"]:\s*(.+)$/s,
    /^Error invoking remote (?:method|function)\s+\S+:\s*(.+)$/s,
];

function unwrapRemoteErrorMessage(message: string): string {
    for (const pattern of REMOTE_ERROR_PATTERNS) {
        const normalized = message.match(pattern)?.[1]?.trim();
        if (normalized) return normalized;
    }
    return message;
}

/**
 * Extracts a human-readable message from any thrown value.
 * Handles native Error objects and IPC error objects { __error: true, message: string }.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
    if (err instanceof Error) {
        return unwrapRemoteErrorMessage(err.message);
    }
    if (
        err &&
        typeof err === 'object' &&
        typeof (err as { message?: unknown }).message === 'string'
    ) {
        const message = (err as { message: string }).message;
        return unwrapRemoteErrorMessage(message);
    }
    return fallback ?? 'Une erreur inattendue est survenue.';
}

export function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';

    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const paddedSecs = String(secs).padStart(2, '0');

    if (hours === 0) return `${minutes}:${paddedSecs}`;
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSecs}`;
}

export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function substrAfter(str: string, substr: string): string {
    return str.slice(str.indexOf(substr) + substr.length);
}

export const respondToVisibility = (
    element: Element | HTMLElement,
    callback: (value: boolean) => void,
) => {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => callback(entry.intersectionRatio > 0));
        },
        { root: document.documentElement },
    );
    observer.observe(element);
    return () => observer.unobserve(element);
};
