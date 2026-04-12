import type { TFunction } from 'i18next';
import type { Unit } from 'react-timeago';

const RELATIVE_TIME_TRANSLATION_KEYS: Record<Unit, string> = {
    second: '{{count}}s',
    minute: '{{count}}min',
    hour: '{{count}}h',
    day: '{{count}}j',
    week: '{{count}}sem',
    month: '{{count}}mois',
    year: '{{count}}a',
};

export function formatRelativeTimeLabel(t: TFunction, value: number, unit: Unit): string {
    if (unit === 'second' && value < 5) {
        return t('maintenant');
    }

    return t(RELATIVE_TIME_TRANSLATION_KEYS[unit], { count: value });
}

export function formatAbsoluteDateTime(
    date: string | number | Date,
    locale: string | undefined,
): string | undefined {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return undefined;
    }

    return new Intl.DateTimeFormat(locale ?? 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsedDate);
}
