import type { TFunction } from 'i18next';
import type { Unit } from 'react-timeago';

function formatRelativeTimeValue(t: TFunction, value: number, unit: Unit): string {
    switch (unit) {
        case 'second':
            return t("moins d'une minute");
        case 'minute':
            return value <= 1 ? t('environ une minute') : t('{{count}} minutes', { count: value });
        case 'hour':
            return value <= 1
                ? t('environ une heure')
                : t('environ {{count}} heures', { count: value });
        case 'day':
            return value <= 1 ? t('un jour') : t('{{count}} jours', { count: value });
        case 'week':
            return value <= 1 ? t('une semaine') : t('{{count}} semaines', { count: value });
        case 'month':
            return value <= 1 ? t('environ un mois') : t('{{count}} mois', { count: value });
        case 'year':
            return value <= 1 ? t('environ un an') : t('{{count}} ans', { count: value });
        default:
            return t('{{count}} minutes', { count: value });
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
