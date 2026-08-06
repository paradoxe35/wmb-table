import { countMatches } from '../pdf-extract.service';

/**
 * A subset font with no usable ToUnicode CMap yields glyph codes, not characters.
 * The shift observed is a constant 0x20, but that is not a documented invariant,
 * so such runs are dropped rather than "repaired" into plausible wrong text.
 */

/** Where Latin capitals land when glyph codes are read as characters. */
const SHIFTED_CAPITAL_BEFORE_LETTER = /[!-:]\p{Lu}/u;
const UNMAPPED_GLYPH = /[\uFFFD\uE000-\uF8FF]/gu;

/** Apostrophes, hyphens, dots and slashes are excluded: real words contain them. */
const PUNCTUATION_INSIDE_WORD = /\p{L}[!"#$%&()*+,:;<=>?@[\\\]^{|}~]\p{L}/u;

const CONTROL_CHARACTER = /[\u0000-\u0008\u000B-\u001F]/u;

const MIN_RUN_CHARS = 8;
const MAX_UNMAPPED_RATIO = 0.1;
const MIN_LETTER_RATIO = 0.25;
const MIN_BROKEN_WORD_RATIO = 0.25;

export function isUnreadableTextRun(text: string): boolean {
    if (CONTROL_CHARACTER.test(text)) return true;

    const compact = text.replace(/\s+/gu, '');
    if (compact.length < MIN_RUN_CHARS) return false;

    if (countMatches(compact, UNMAPPED_GLYPH) / compact.length > MAX_UNMAPPED_RATIO) {
        return true;
    }

    const letters = countMatches(compact, /\p{L}/gu);
    if (letters / compact.length < MIN_LETTER_RATIO) return true;
    if (letters < 4) return false;

    const words = text.split(/\s+/u).filter(Boolean);
    if (words.some((word) => PUNCTUATION_INSIDE_WORD.test(word))) return true;

    // Lowercase is the shifted form of nothing, so its presence clears the CMap.
    if (words.length < 2 || countMatches(compact, /\p{Ll}/gu) > 0) return false;

    const shifted = words.filter((word) => SHIFTED_CAPITAL_BEFORE_LETTER.test(word)).length;
    return shifted / words.length >= MIN_BROKEN_WORD_RATIO;
}
