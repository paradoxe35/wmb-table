import type { DocumentIdentity, DocumentTab } from '@shared/types';
import type { PendingNavigation } from '@renderer/stores/document-tabs.store';

type PendingNavigationTargetInput = DocumentIdentity;

export function pendingNavigationMatchesDocument(
    pendingNavigation: PendingNavigation,
    current: DocumentIdentity,
): boolean {
    if (!pendingNavigation) return false;

    const target = pendingNavigation.target;
    if (target.documentType !== current.documentType) return false;

    switch (current.documentType) {
        case 'custom': {
            if (target.documentType !== 'custom') return false;
            return target.customDocumentId === current.customDocumentId;
        }
        case 'bible': {
            if (target.documentType !== 'bible') return false;
            if (target.bibleBook !== current.bibleBook) {
                return false;
            }
            if (target.bibleChapter !== current.bibleChapter) {
                return false;
            }
            if (
                target.bibleVersionAbbreviation &&
                target.bibleVersionAbbreviation !== current.bibleVersionAbbreviation
            ) {
                return false;
            }
            return true;
        }
        case 'sermon': {
            if (target.documentType !== 'sermon') return false;
            if (target.sermonId !== current.sermonId) {
                return false;
            }
            if (target.translationId != null && target.translationId !== current.translationId) {
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

    switch (activeTab.type) {
        case 'custom':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'custom',
                customDocumentId: activeTab.documentId,
            });
        case 'bible':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'bible',
                bibleBook: activeTab.bibleBook,
                bibleChapter: activeTab.bibleChapter,
            });
        case 'sermon':
            return pendingNavigationMatchesDocument(pendingNavigation, {
                documentType: 'sermon',
                sermonId: activeTab.documentId,
                translationId: activeTab.translationId,
            });
    }
}

export function buildPendingNavigationTarget(
    request: PendingNavigationTargetInput,
): DocumentIdentity {
    switch (request.documentType) {
        case 'custom':
            return {
                documentType: 'custom',
                customDocumentId: request.customDocumentId,
            };
        case 'bible':
            return {
                documentType: 'bible',
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
