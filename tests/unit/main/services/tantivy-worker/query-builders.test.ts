import { describe, expect, it } from 'vitest';
import { Document, Index, SchemaBuilder } from '@pngwasi/node-tantivy-binding';
import { buildModeQuery } from '@main/services/tantivy-worker/query-builders';

function buildIndex(lines: string[]): Index {
    const schema = new SchemaBuilder().addTextField('unstemmed_content', { stored: true }).build();
    const index = new Index(schema);
    const writer = index.writer(15_000_000, 1);
    for (const line of lines) {
        writer.addDocument(Document.fromDict({ unstemmed_content: line }, schema));
    }
    writer.commit();
    index.reload();
    return index;
}

const index = buildIndex(['La foi vient de ce qu’on entend', 'Le Saint-Esprit', 'Un autre jour']);

function countMatches(query: string, mode: 'any' | 'all' | 'exact'): number {
    return index.searcher().search(buildModeQuery(index, query, mode), 10, true).count ?? 0;
}

describe('buildModeQuery', () => {
    it.each([
        ['punctuation only', '??', 'all'],
        ['single letters in all mode', 'a b', 'all'],
        ['single letters in any mode', 'a b', 'any'],
        ['empty text', '', 'exact'],
    ] as const)('matches nothing for %s instead of every line', (_case, query, mode) => {
        expect(countMatches(query, mode)).toBe(0);
    });

    it('still matches a real word', () => {
        expect(countMatches('foi', 'all')).toBe(1);
        expect(countMatches('Saint-Esprit', 'exact')).toBe(1);
    });
});
