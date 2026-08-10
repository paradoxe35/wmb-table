import { describe, expect, it } from 'vitest';
import { TextAnalyzerBuilder, TokenizerStatic, FilterStatic } from '@pngwasi/node-tantivy-binding';
import { tokenizeQuery } from '@shared/searchable';

/**
 * Query terms must be the terms the Tantivy index holds. The index is built with Tantivy's
 * default analyzer, so our tokenizer has to split identically — otherwise a search asks for
 * terms that were never indexed.
 */
const tantivy = new TextAnalyzerBuilder(TokenizerStatic.simple())
    .filter(FilterStatic.lowercase())
    .build();

const PHRASES = [
    'Le Baptême du Saint-Esprit',
    'Иисус Христос воскрес',
    'ἡ ἀγάπη τοῦ Θεοῦ',
    'السلام عليكم',
    'परमेश्वर की कृपा',
    'தேவனுடைய கிருபை',
    'ঈশ্বরের অনুগ্রহ',
    'ព្រះគុណ',
    '하나님의 은혜',
    '恩典',
    'Anh Nguyễn',
    'Jean 3:16',
    "l'Agneau de Dieu",
];

describe('tokenizer parity with Tantivy', () => {
    it.each(PHRASES)('splits "%s" the same way Tantivy does', (phrase) => {
        const ours = tokenizeQuery(phrase, 'exact').map((word) => word.toLowerCase());

        expect(ours).toEqual(tantivy.analyze(phrase));
    });
});
