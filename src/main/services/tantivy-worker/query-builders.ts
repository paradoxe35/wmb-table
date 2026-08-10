import { Index, Query } from '@pngwasi/node-tantivy-binding';
import { tokenizeQuery } from '@shared/searchable';
import { getTextFieldNames } from './shared';

const PHRASE_SLOP = 25;
const MIN_WORD_LENGTH_ONE_TYPO = 5;
const MIN_WORD_LENGTH_TWO_TYPOS = 9;

function getAllowedTypoDistance(word: string): number {
    if (word.length >= MIN_WORD_LENGTH_TWO_TYPOS) return 2;
    if (word.length >= MIN_WORD_LENGTH_ONE_TYPO) return 1;
    return 0;
}

function getSearchField(index: Index): string {
    const fields = getTextFieldNames(index);
    return fields.includes('unstemmed_content') ? 'unstemmed_content' : fields[0];
}

export function buildModeQuery(
    index: Index,
    queryText: string,
    mode: 'any' | 'all' | 'exact',
): Query {
    const schema = index.schema;
    const words = tokenizeQuery(queryText, mode);
    const field = getSearchField(index);

    if (words.length === 0) return Query.allQuery();

    function wordQuery(word: string): Query {
        const lowered = word.toLowerCase();
        const distance = getAllowedTypoDistance(lowered);
        if (distance === 0) {
            return Query.termQuery(schema, field, lowered);
        }
        const exact = Query.boostQuery(Query.termQuery(schema, field, lowered), 2.0);
        const fuzzy = Query.fuzzyTermQuery(schema, field, lowered, distance, true, true);
        return Query.disjunctionMaxQuery([exact, fuzzy], 0.1);
    }

    if (words.length === 1) {
        return wordQuery(words[0]);
    }

    switch (mode) {
        case 'exact':
            return Query.phraseQuery(
                schema,
                field,
                words.map((w) => w.toLowerCase()),
                PHRASE_SLOP,
            );
        case 'all':
            return Query.booleanQuery(words.map((w) => ({ occur: 'must', query: wordQuery(w) })));
        case 'any':
            return Query.disjunctionMaxQuery(
                words.map((w) => wordQuery(w)),
                0.1,
            );
    }
}

/**
 * Legacy query builder using parseQueryLenient.
 * Only used by getSearchSnippet (SnippetGenerator requires a parsed query).
 */
export function buildLegacyQuery(index: Index, queryText: string): Query {
    const textFields = getTextFieldNames(index);
    const fieldBoosts: Record<string, number> = {};
    const fuzzyFields: Record<string, [boolean, number, boolean]> = {};
    for (const field of textFields) {
        fieldBoosts[field] = field === 'unstemmed_content' ? 2.0 : 1.0;
        fuzzyFields[field] = [true, 1, true];
    }

    const sanitized = queryText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `"${t.replace(/"/g, '')}"`)
        .join(' ');
    const [query] = index.parseQueryLenient(sanitized, textFields, fieldBoosts, fuzzyFields);
    return query;
}
