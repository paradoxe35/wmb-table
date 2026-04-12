import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { formatAbsoluteDateTime, formatRelativeTimeLabel } from '@renderer/lib/relative-time';

function createStubTranslator(): TFunction {
    return ((key: string, options?: { count?: number }) =>
        key.replace('{{count}}', String(options?.count ?? ''))) as TFunction;
}

describe('formatRelativeTimeLabel', () => {
    const t = createStubTranslator();

    it('uses now for the first few seconds', () => {
        expect(formatRelativeTimeLabel(t, 4, 'second')).toBe('maintenant');
    });

    it('formats short translated units', () => {
        expect(formatRelativeTimeLabel(t, 12, 'second')).toBe('12s');
        expect(formatRelativeTimeLabel(t, 5, 'minute')).toBe('5min');
        expect(formatRelativeTimeLabel(t, 2, 'hour')).toBe('2h');
        expect(formatRelativeTimeLabel(t, 3, 'day')).toBe('3j');
        expect(formatRelativeTimeLabel(t, 1, 'week')).toBe('1sem');
        expect(formatRelativeTimeLabel(t, 7, 'month')).toBe('7mois');
        expect(formatRelativeTimeLabel(t, 2, 'year')).toBe('2a');
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
