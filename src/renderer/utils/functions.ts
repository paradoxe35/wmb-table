export { debounce, throttle, capitalize as capitalizeFirstLetter } from 'lodash';

export function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getDateTime(date?: Date) {
    date = date || new Date();
    const int = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' });
    const formatted = int.format(date);
    return {
        date: formatted.charAt(0).toUpperCase() + formatted.slice(1),
        time: date.toTimeString().split(' ')[0],
        milliseconds: date.getTime(),
    };
}

export function trimBeforeDotAndComma(text = '', splitters: string[] = []) {
    splitters.forEach((splitter) => {
        text = text
            .split(splitter)
            .map((d) => d.trimEnd())
            .join(splitter);
    });
    return text;
}

export function secondsForHumans(seconds: number | undefined): string | number {
    if (seconds == null) return 0;
    seconds = Math.abs(seconds);
    const levels: [number, string][] = [
        [Math.floor(seconds / 31536000), 'ans'],
        [Math.floor((seconds % 31536000) / 86400), 'jours'],
        [Math.floor(((seconds % 31536000) % 86400) / 3600), 'heurs'],
        [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
        [(((seconds % 31536000) % 86400) % 3600) % 60, 'secondes'],
    ];
    let returntext = '';
    for (const [val, label] of levels) {
        if (val === 0) continue;
        returntext +=
            ' ' + val.toFixed(0) + ' ' + (val === 1 ? label.substring(0, label.length - 1) : label);
    }
    return returntext.trim();
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

export const rafThrottle = (callback: (...args: unknown[]) => void) => {
    let requestId: number | null = null;
    let lastArgs: unknown[];

    const later = (context: unknown) => () => {
        requestId = null;
        callback.apply(context, lastArgs);
    };

    const throttled = function (this: unknown, ...args: unknown[]) {
        lastArgs = args;
        if (requestId === null) {
            requestId = requestAnimationFrame(later(this));
        }
    };

    throttled.cancel = () => {
        if (requestId != null) cancelAnimationFrame(requestId);
        requestId = null;
    };

    return throttled;
};
