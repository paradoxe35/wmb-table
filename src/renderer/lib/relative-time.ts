import type { TFunction } from 'i18next';
import type { Unit } from 'react-timeago';

function formatRelativeTimeValue(t: TFunction, value: number, unit: Unit): string {
    switch (unit) {
        case 'second':
            return t('maintenant');
        case 'minute':
            return t('{{count}}min', { count: value });
        case 'hour':
            return t('{{count}}h', { count: value });
        case 'day':
            return t('{{count}}j', { count: value });
        case 'week':
            return t('{{count}}sem', { count: value });
        case 'month':
            return t('{{count}}mois', { count: value });
        case 'year':
            return t('{{count}}a', { count: value });
        default:
            return t('{{count}}min', { count: value });
    }
}

export function formatRelativeTimeLabel(t: TFunction, value: number, unit: Unit): string {
    return formatRelativeTimeValue(t, value, unit);
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
