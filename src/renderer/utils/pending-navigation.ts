import type { DocumentTab, DocumentType } from '@shared/types';
import type { PendingNavigation, PendingNavigationTarget } from '@renderer/stores/sermon.store';

type SermonDocumentIdentity = {
    documentType: 'sermon';
    sermonId?: string;
    translationId?: number;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
    customDocumentId?: never;
};

type BibleDocumentIdentity = {
    documentType: 'bible';
    sermonId?: string;
    bibleBook?: string;
    bibleChapter?: string;
    bibleVersionAbbreviation?: string;
    translationId?: never;
    customDocumentId?: never;
};

type CustomDocumentIdentity = {
    documentType: 'custom';
    sermonId?: string;
    customDocumentId?: string;
    translationId?: never;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
};

export type CurrentDocumentIdentity =
    | SermonDocumentIdentity
    | BibleDocumentIdentity
    | CustomDocumentIdentity;

type PendingNavigationTargetInput = {
    documentType: DocumentType;
    sermonId: string;
    translationId?: number;
    bibleBook?: string;
    bibleChapter?: string;
    bibleVersionAbbreviation?: string;
    customDocumentId?: string;
};

export function pendingNavigationMatchesDocument(
    pendingNavigation: PendingNavigation,
    current: CurrentDocumentIdentity,
): boolean {
    if (!pendingNavigation) return false;

    const target = pendingNavigation.target;
    if (target.documentType !== current.documentType) return false;

    switch (current.documentType) {
        case 'custom': {
            if (target.documentType !== 'custom') return false;
            if (
                target.customDocumentId &&
                current.customDocumentId &&
                target.customDocumentId === current.customDocumentId
            ) {
                return true;
            }
            if (target.sermonId && current.sermonId && target.sermonId === current.sermonId) {
                return true;
            }
            return false;
        }
        case 'bible': {
            if (target.documentType !== 'bible') return false;
            if (target.bibleBook && current.bibleBook && target.bibleBook !== current.bibleBook) {
                return false;
            }
            if (
                target.bibleChapter &&
                current.bibleChapter &&
                target.bibleChapter !== current.bibleChapter
            ) {
                return false;
            }
            if (
                target.bibleVersionAbbreviation &&
                current.bibleVersionAbbreviation &&
                target.bibleVersionAbbreviation !== current.bibleVersionAbbreviation
            ) {
                return false;
            }
            if (target.sermonId && current.sermonId && target.sermonId !== current.sermonId) {
                return false;
            }
            return true;
        }
        case 'sermon': {
            if (target.documentType !== 'sermon') return false;
            if (target.sermonId && current.sermonId && target.sermonId !== current.sermonId) {
                return false;
            }
            if (
                target.translationId != null &&
                current.translationId != null &&
                target.translationId !== current.translationId
            ) {
                return false;
            }
            return true;
        }
    }
}

export function pendingNavigationMatchesTab(
    pendingNavigation: PendingNavigation,
    activeTab: DocumentTab | null,
): boolean {
    if (!activeTab) return false;

    switch (activeTab.type ?? 'sermon') {
        case 'custom':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'custom',
                sermonId: activeTab.sermonId,
                customDocumentId: activeTab.sermonId,
            });
        case 'bible':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'bible',
                sermonId: activeTab.sermonId,
                bibleBook: activeTab.bibleBook,
                bibleChapter: activeTab.bibleChapter,
            });
        case 'sermon':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'sermon',
                sermonId: activeTab.sermonId,
                translationId: activeTab.translationId,
            });
    }
}

export function buildPendingNavigationTarget(
    request: PendingNavigationTargetInput,
): PendingNavigationTarget {
    switch (request.documentType) {
        case 'custom':
            return {
                documentType: 'custom',
                sermonId: request.sermonId,
                customDocumentId: request.customDocumentId ?? request.sermonId,
            };
        case 'bible':
            return {
                documentType: 'bible',
                sermonId: request.sermonId,
                bibleBook: request.bibleBook,
                bibleChapter: request.bibleChapter,
                bibleVersionAbbreviation: request.bibleVersionAbbreviation,
            };
        case 'sermon':
            return {
                documentType: 'sermon',
                sermonId: request.sermonId,
                translationId: request.translationId,
            };
    }
}
