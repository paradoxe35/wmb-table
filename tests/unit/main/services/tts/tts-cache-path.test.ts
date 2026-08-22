import { describe, expect, it } from 'vitest';
import { pathSafe } from '@main/services/tts/tts-cache';

describe('pathSafe', () => {
    it('folds the colon a voice id carries, which Windows reads as a drive', () => {
        expect(pathSafe('vits-piper-fr_FR-tom-medium-int8:0')).toBe(
            'vits-piper-fr_FR-tom-medium-int8_0',
        );
    });

    it('folds every character Windows refuses in a name', () => {
        expect(pathSafe('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    it('leaves an ordinary segment untouched', () => {
        expect(pathSafe('vits-piper-fr_FR-siwis-medium')).toBe('vits-piper-fr_FR-siwis-medium');
        expect(pathSafe('fr')).toBe('fr');
    });

    it('never returns an empty segment, which would collapse the path', () => {
        expect(pathSafe('')).toBe('_');
    });

    it('folds the colon in a Pocket voice id', () => {
        expect(pathSafe('french:anna')).toBe('french_anna');
        expect(pathSafe('english:peter_yearsley')).toBe('english_peter_yearsley');
    });

    it('refuses to name a segment that would walk out of the cache', () => {
        expect(pathSafe('.')).toBe('_');
        expect(pathSafe('..')).toBe('_');
    });

    it('escapes the names Windows reserves for devices', () => {
        expect(pathSafe('CON')).toBe('_CON');
        expect(pathSafe('nul')).toBe('_nul');
        expect(pathSafe('com1')).toBe('_com1');
        expect(pathSafe('console')).toBe('console');
    });

    it('caps a segment a provider returned overlong', () => {
        expect(pathSafe('x'.repeat(300))).toHaveLength(120);
    });
});
