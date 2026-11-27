import type { DocumentTab } from '@shared/types';
import { getDocumentIdentityFromTab, getDocumentIdentityKey, getTabKey } from '@shared/types';
import { useAppStore, useDocumentTabsStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import {
    buildReadingPositionKey,
    buildSermonContentKey,
    resolveBibleScrollPersistence,
    resolveCustomDocumentScrollPersistence,
    resolveSermonScrollPersistence,
} from './document-content-hooks';

/** The same key the document views save their reading position under. */
export function readingPositionKeyForTab(tab: DocumentTab): string | null {
    switch (tab.type) {
        case 'sermon':
            return resolveSermonScrollPersistence(tab, null).readingPositionKey;
        case 'custom':
            return resolveCustomDocumentScrollPersistence(tab.documentId).readingPositionKey;
        case 'bible':
            return resolveBibleScrollPersistence(
                tab.bibleBook,
                tab.bibleChapter,
                null,
                tab.bibleVersionAbbreviation ?? '',
            ).readingPositionKey;
    }
}

/** The reading position key for a read-aloud key (`getDocumentIdentityKey`), even with no tab open. */
export function readingPositionKeyForDocumentKey(documentKey: string): string | null {
    const [type, ...parts] = documentKey.split(':');
    if (type === 'custom' && parts.length > 0) {
        return resolveCustomDocumentScrollPersistence(parts.join(':')).readingPositionKey;
    }
    if (type === 'sermon' && parts.length === 3) {
        const [languageCode, sermonId, translationId] = parts;
        return buildReadingPositionKey(
            'sermon',
            buildSermonContentKey(languageCode, Number(translationId), sermonId),
        );
    }
    if (type === 'bible' && parts.length === 3) {
        const [book, chapter, version] = parts;
        return resolveBibleScrollPersistence(book, chapter, null, version).readingPositionKey;
    }
    return null;
}

/** Reading position key → the read-aloud key of the document that was read to its end. */
const finished = new Map<string, string>();

/**
 * The voice read the document to its end: it opens at the start next time. The view may still be
 * at the end and save that position when it unmounts (a Bible chapter moving on to the next one),
 * so the document is remembered as finished until the reader scrolls it or reads it again.
 */
export function resetFinishedDocument(documentKey: string | null): void {
    const readingKey = documentKey ? readingPositionKeyForDocumentKey(documentKey) : null;
    if (!documentKey || !readingKey) return;

    finished.set(readingKey, documentKey);
    const { tabs, updateTabScroll } = useDocumentTabsStore.getState();
    const tab = tabs.find(
        (candidate) =>
            getDocumentIdentityKey(getDocumentIdentityFromTab(candidate)) === documentKey,
    );
    // A tab with no position of its own restores from the saved one; setting it here would
    // change the restore source and jump the open document to the start right away
    if (tab && tab.scrollY !== undefined) updateTabScroll(getTabKey(tab), 0, 0);
    if (useAppStore.getState().rememberReadingPosition) {
        void window.api.documents.saveReadingPosition(readingKey, 0);
    }
}

/** False again once the reader starts the voice on it once more. */
export function isReadingFinished(readingKey: string | null): boolean {
    if (!readingKey) return false;
    const documentKey = finished.get(readingKey);
    if (documentKey == null) return false;
    const { documentKey: reading, status } = useTtsStore.getState();
    if (reading === documentKey && status !== 'idle' && status !== 'error') {
        finished.delete(readingKey);
        return false;
    }
    return true;
}

/** The reader scrolled or jumped in the document, or opened it again: its position counts again. */
export function clearReadingFinished(readingKey: string | null): void {
    if (readingKey) finished.delete(readingKey);
}
