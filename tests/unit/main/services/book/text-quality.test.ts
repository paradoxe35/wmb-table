import { describe, expect, it } from 'vitest';
import { isUnreadableTextRun } from '@main/services/book/text-quality';

describe('broken-font detection', () => {
    it('flags glyph codes read as characters', () => {
        expect(isUnreadableTextRun('4!",% /& #/.4%.43')).toBe(true);
        expect(isUnreadableTextRun('4HE 2EVELATION /& *ESUS #HRIST')).toBe(true);
        expect(isUnreadableTextRun('"O&YQPTJUJPO PGUIF 4FWFO$IVSDI')).toBe(true);
    });

    it('flags runs of unmapped glyphs', () => {
        expect(isUnreadableTextRun('\uE001\uE002\uE003 \uE004\uE005\uE006\uE007\uE008')).toBe(true);
        expect(isUnreadableTextRun('\uFFFD'.repeat(10))).toBe(true);
    });

    it('keeps ordinary text in every script', () => {
        expect(isUnreadableTextRun('The Revelation of Jesus Christ')).toBe(false);
        expect(isUnreadableTextRun('AN EXPOSITION OF THE SEVEN CHURCH AGES')).toBe(false);
        expect(isUnreadableTextRun('ENG. REVELATION OF JESUS CHRIST P7 REV #: 7')).toBe(false);
        expect(isUnreadableTextRun('Exposé des Sept Âges de l’Église')).toBe(false);
        expect(isUnreadableTextRun('ОТКРОВЕНИЕ ИИСУСА ХРИСТА')).toBe(false);
        expect(isUnreadableTextRun('ΑΠΟΚΑΛΥΨΙΣ ΙΗΣΟΥ ΧΡΙΣΤΟΥ')).toBe(false);
        expect(isUnreadableTextRun('耶穌基督的啟示，就是神賜給他的')).toBe(false);
        expect(isUnreadableTextRun('رؤيا يسوع المسيح التي أعطاه إياها الله')).toBe(false);
    });

    it('leaves short runs alone', () => {
        expect(isUnreadableTextRun('1:1-20')).toBe(false);
        expect(isUnreadableTextRun('12')).toBe(false);
    });

    it('keeps punctuation that words legitimately contain', () => {
        expect(isUnreadableTextRun('Jésus-Christ, l’Église et www.example.org')).toBe(false);
    });
});
