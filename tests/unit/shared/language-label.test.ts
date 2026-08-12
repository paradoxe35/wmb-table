import { describe, expect, it } from 'vitest';
import { languageLabel, voiceLanguageCode } from '@shared/tts.types';

describe('languageLabel', () => {
    it('names a language in the language the reader is using', () => {
        expect(languageLabel('en', 'fr')).toBe('Anglais');
        expect(languageLabel('en', 'sw')).toBe('Kiingereza');
        expect(languageLabel('pt-BR', 'fr')).toBe('Portugais brésilien');
    });

    it('capitalises a name that heads a row, in any cased script', () => {
        expect(languageLabel('fr', 'fr')).toBe('Français');
        expect(languageLabel('ru', 'ru')).toBe('Русский');
    });

    it('leaves a lowercase prefix alone, which carries meaning of its own', () => {
        expect(languageLabel('zu', 'zu')).toBe('isiZulu');
        expect(languageLabel('sn', 'sn')).toBe('chiShona');
    });

    it('adds no capital to a script that has none to give', () => {
        expect(languageLabel('ka', 'ka')).toBe('ქართული');
        expect(languageLabel('ja', 'ja')).toBe('日本語');
        expect(languageLabel('ar', 'ar')).toBe('العربية');
    });
});

describe('voiceLanguageCode', () => {
    it('folds a three-letter code to the one voices are listed under', () => {
        expect(voiceLanguageCode('zho')).toBe('zh');
        expect(voiceLanguageCode('tsn')).toBe('tn');
    });

    it('reaches a voice for a language the app spells its own way', () => {
        // `ua` is not Ukrainian to anyone but this app, and `cre` is Cree, not Haitian Creole.
        expect(voiceLanguageCode('ua')).toBe('uk');
        expect(voiceLanguageCode('cre')).toBe('ht');
    });

    it('falls back to the nearest language a voice exists for', () => {
        expect(voiceLanguageCode('twi')).toBe('ak');
        expect(voiceLanguageCode('emk')).toBe('vmw');
    });

    it('leaves a code alone when voices already use it', () => {
        expect(voiceLanguageCode('fr')).toBe('fr');
        expect(voiceLanguageCode('pt-BR')).toBe('pt');
    });
});
