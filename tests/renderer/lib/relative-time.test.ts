import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { formatAbsoluteDateTime, formatRelativeTimeLabel } from '@renderer/lib/relative-time';

function createStubTranslator(): TFunction {
    return ((key: string, options?: { count?: number }) =>
        key.replace('{{count}}', String(options?.count ?? ''))) as TFunction;
}

describe('formatRelativeTimeLabel', () => {
    const t = createStubTranslator();

    it('formats plain relative labels', () => {
        expect(formatRelativeTimeLabel(t, 4, 'second')).toBe("moins d'une minute");
        expect(formatRelativeTimeLabel(t, 1, 'minute')).toBe('environ une minute');
        expect(formatRelativeTimeLabel(t, 5, 'minute')).toBe('5 minutes');
        expect(formatRelativeTimeLabel(t, 1, 'hour')).toBe('environ une heure');
        expect(formatRelativeTimeLabel(t, 2, 'hour')).toBe('environ 2 heures');
        expect(formatRelativeTimeLabel(t, 1, 'day')).toBe('un jour');
        expect(formatRelativeTimeLabel(t, 3, 'day')).toBe('3 jours');
        expect(formatRelativeTimeLabel(t, 1, 'week')).toBe('une semaine');
        expect(formatRelativeTimeLabel(t, 7, 'month')).toBe('7 mois');
        expect(formatRelativeTimeLabel(t, 2, 'year')).toBe('2 ans');
    });
});

describe('formatAbsoluteDateTime', () => {
    it('returns undefined for invalid dates', () => {
        expect(formatAbsoluteDateTime('invalid-date', 'en')).toBeUndefined();
    });

    it('returns a localized absolute date for valid dates', () => {
        expect(formatAbsoluteDateTime('2026-04-12T14:30:00.000Z', 'en')).toBeTruthy();
    });
});
