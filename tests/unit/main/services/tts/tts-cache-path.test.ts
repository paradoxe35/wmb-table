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
});
