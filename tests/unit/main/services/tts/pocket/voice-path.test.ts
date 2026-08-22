import { describe, expect, it } from 'vitest';
import { pathSafe } from '@main/services/tts/tts-cache';

/** Pocket voice ids carry a colon (`french:anna`), which Windows reads as a drive separator. */
describe('pocket voice ids on disk', () => {
    it('folds the colon out of a voice id', () => {
        expect(pathSafe('french:anna')).toBe('french_anna');
        expect(pathSafe('english:peter_yearsley')).toBe('english_peter_yearsley');
    });

    it('leaves nothing a file system would reject', () => {
        for (const id of ['french:anna', 'italian:bill_boerst', 'german:caro_davy']) {
            expect(pathSafe(id)).not.toMatch(/[<>:"/\\|?*]/);
        }
    });

    it('never yields an empty segment', () => {
        expect(pathSafe(':')).toBe('_');
        expect(pathSafe('')).toBe('_');
    });
});
