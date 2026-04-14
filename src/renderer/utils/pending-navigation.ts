import { isParagraphReference, type DocumentIdentity, type DocumentTab } from '@shared/types';
import { documentIdentityEquals, getDocumentIdentityFromTab } from '@shared/types';
import type { PendingNavigation } from '@renderer/stores/document-tabs.store';

export function pendingNavigationMatchesDocument(
    pendingNavigation: PendingNavigation,
    current: DocumentIdentity,
): boolean {
    if (!pendingNavigation) {
        return false;
    }
    return documentIdentityEquals(pendingNavigation.target, current);
}

export function pendingNavigationMatchesTab(
    pendingNavigation: PendingNavigation,
    activeTab: DocumentTab | null,
): boolean {
    if (!activeTab) return false;
    return pendingNavigationMatchesDocument(
        pendingNavigation,
        getDocumentIdentityFromTab(activeTab),
    );
}

export function getPendingNavigationParagraphIndex(
    pendingNavigation: PendingNavigation,
    current: DocumentIdentity | null,
): number | null {
    if (
        !pendingNavigation ||
        !current ||
        !pendingNavigationMatchesDocument(pendingNavigation, current)
    ) {
        return null;
    }

    const ref = pendingNavigation.documentReference;
    if (!ref) {
        return null;
    }

    return isParagraphReference(ref) ? ref.paragraphIndex : (ref.tree[0] ?? null);
}
