import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { StarterKit } from '@tiptap/starter-kit';
import { searchDocument } from '@tiptap/extension-find-and-replace';
import { accentInsensitivePattern } from '@shared/searchable';
import { isFindShortcut } from '@renderer/views/options/notes/editor-tiptap/use-find-bar';

const schema = getSchema([StarterKit]);

function noteOf(...paragraphs: string[]): Node {
    return schema.node(
        'doc',
        null,
        paragraphs.map((text) => schema.node('paragraph', null, [schema.text(text)])),
    );
}

function find(doc: Node, term: string, caseSensitive = false): string[] {
    const results = searchDocument(doc, accentInsensitivePattern(term), {
        useRegex: true,
        caseSensitive,
        wholeWord: false,
    });
    return results.map((result) => doc.textBetween(result.from, result.to));
}

describe('note search', () => {
    it('finds a word whether or not the note spells it with accents', () => {
        const doc = noteOf('Le Baptême du Saint-Esprit.', 'Un autre bapteme, sans accent.');

        expect(find(doc, 'Bapteme')).toEqual(['Baptême', 'bapteme']);
        expect(find(doc, 'Baptême')).toEqual(['Baptême', 'bapteme']);
    });

    it('returns matches in document order', () => {
        const doc = noteOf('Premier foi.', 'Deuxieme foi.', 'Troisieme foi.');
        const positions = searchDocument(doc, accentInsensitivePattern('foi'), {
            useRegex: true,
            caseSensitive: false,
            wholeWord: false,
        }).map((result) => result.from);

        expect(positions).toHaveLength(3);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it('matches a word split across marks, as when part of it is bold', () => {
        const bold = schema.marks.bold.create();
        const doc = schema.node('doc', null, [
            schema.node('paragraph', null, [
                schema.text('Le Bapt'),
                schema.text('ême', [bold]),
                schema.text(' du Seigneur'),
            ]),
        ]);

        expect(find(doc, 'bapteme')).toEqual(['Baptême']);
    });

    it('never runs a match past the end of a paragraph', () => {
        const doc = noteOf('La foi', 'vient de Dieu');

        expect(find(doc, 'foi vient')).toEqual([]);
    });

    it('honours case sensitivity while staying accent insensitive', () => {
        const doc = noteOf('Baptême et bapteme.');

        expect(find(doc, 'Bapteme', true)).toEqual(['Baptême']);
        expect(find(doc, 'Bapteme', false)).toEqual(['Baptême', 'bapteme']);
    });

    it('matches either apostrophe style', () => {
        const doc = noteOf('Voici l’Agneau de Dieu.');

        expect(find(doc, "l'Agneau")).toEqual(['l’Agneau']);
    });

    it('searches Greek and Cyrillic the same way', () => {
        expect(find(noteOf('Ἰησοῦς Χριστός'), 'Ιησους')).toEqual(['Ἰησοῦς']);
        expect(find(noteOf('Иису́с Христо́с'), 'Иисус')).toEqual(['Иису́с']);
    });

    it('treats a typed regex as literal text', () => {
        const doc = noteOf('Le verset 3.16 exactement.');

        expect(find(doc, '3.16')).toEqual(['3.16']);
        expect(find(doc, '3x16')).toEqual([]);
    });

    it('finds nothing for a term absent from the note', () => {
        expect(find(noteOf('La foi vient de Dieu.'), 'résurrection')).toEqual([]);
    });
});

describe('isFindShortcut', () => {
    const event = (patch: Partial<KeyboardEvent>) => ({
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: 'f',
        ...patch,
    });

    it('accepts Ctrl+F and Cmd+F', () => {
        expect(isFindShortcut(event({ ctrlKey: true }))).toBe(true);
        expect(isFindShortcut(event({ metaKey: true }))).toBe(true);
    });

    it('ignores the plain key and other modifier combinations', () => {
        expect(isFindShortcut(event({}))).toBe(false);
        expect(isFindShortcut(event({ ctrlKey: true, shiftKey: true }))).toBe(false);
        expect(isFindShortcut(event({ ctrlKey: true, altKey: true }))).toBe(false);
        expect(isFindShortcut(event({ ctrlKey: true, key: 'g' }))).toBe(false);
    });
});
