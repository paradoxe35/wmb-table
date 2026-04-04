import { describe, expect, it } from 'vitest';
import {
    buildParagraphsFromLines,
    groupPdfItemsIntoLines,
} from '@main/services/pdf-extract.service';

describe('pdf-extract.service', () => {
    it('merges wrapped lines into a single paragraph', () => {
        const paragraphs = buildParagraphsFromLines([
            'This is a wrapped paragraph that continues',
            'on the next line without a blank separator.',
            '',
            'This starts a second paragraph.',
        ]);

        expect(paragraphs).toEqual([
            'This is a wrapped paragraph that continues on the next line without a blank separator.',
            'This starts a second paragraph.',
        ]);
    });

    it('keeps bullets as separate paragraphs', () => {
        const paragraphs = buildParagraphsFromLines([
            '- First point',
            '- Second point',
            'A normal paragraph follows here.',
        ]);

        expect(paragraphs).toEqual([
            '- First point',
            '- Second point',
            'A normal paragraph follows here.',
        ]);
    });

    it('splits same-baseline content when the horizontal gap suggests separate columns', () => {
        const lines = groupPdfItemsIntoLines([
            {
                str: 'Left column text',
                width: 60,
                height: 10,
                transform: [10, 0, 0, 10, 50, 500],
                hasEOL: false,
            },
            {
                str: 'Right column text',
                width: 70,
                height: 10,
                transform: [10, 0, 0, 10, 260, 500],
                hasEOL: false,
            },
        ]);

        expect(lines).toHaveLength(2);
        expect(lines[0]?.text).toBe('Left column text');
        expect(lines[1]?.text).toBe('Right column text');
    });
});
