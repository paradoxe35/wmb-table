import type { DocumentIdentity, DocumentTab } from '@shared/types';
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
