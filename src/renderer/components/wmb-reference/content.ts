import type { BibleBook } from '@shared/types';

/**
 * Display-ready reference content. Source-agnostic — the modal renders this without
 * caring whether it came from a `wmb://` URL or a saved note reference.
 */

export type SermonReferenceContent = {
    type: 'sermon';
    title: string;
    dateMs: number | null;
    location: string | null;
    paragraphIndex: number | null;
    paragraphText: string | null;
};

export type BibleReferenceContent = {
    type: 'bible';
    label: string;
    versionAbbreviation: string;
    verses: BibleBook[];
};

export type DocReferenceContent = {
    type: 'doc';
    title: string;
    contentSnippet: string | null;
};

export type ReferenceContent = SermonReferenceContent | BibleReferenceContent | DocReferenceContent;
