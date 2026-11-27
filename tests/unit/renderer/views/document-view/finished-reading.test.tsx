// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BibleTab, CustomTab, DocumentTab, SermonTab } from '@shared/types';
import { getDocumentIdentityFromTab, getDocumentIdentityKey } from '@shared/types';
import { useAppStore } from '@renderer/stores/app.store';
import { useDocumentTabsStore } from '@renderer/stores/document-tabs.store';
import { useTtsStore } from '@renderer/stores/tts.store';
import { noteUserJump, noteUserScroll, resumeFollowing } from '@renderer/utils/user-scroll';
import {
    resolveBibleScrollPersistence,
    resolveCustomDocumentScrollPersistence,
    resolveSermonScrollPersistence,
    useScrollAndZoom,
} from '@renderer/views/document-view/hooks';
import {
    clearReadingFinished,
    isReadingFinished,
    readingPositionKeyForDocumentKey,
    readingPositionKeyForTab,
    resetFinishedDocument,
} from '@renderer/views/document-view/hooks/finished-reading';

const sermon: SermonTab = {
    type: 'sermon',
    title: 'La Communion',
    documentId: '65-1212',
    translationId: 7,
    languageCode: 'fr',
    active: true,
};
const chapterOne: BibleTab = {
    type: 'bible',
    title: 'Genèse 1',
    documentId: 'GEN:1',
    bibleBook: 'GEN',
    bibleChapter: '1',
    bibleVersionAbbreviation: 'LSG',
    active: true,
};
const custom: CustomTab = { type: 'custom', title: 'Notes', documentId: 'doc-1', active: true };

const keyOf = (tab: DocumentTab) => getDocumentIdentityKey(getDocumentIdentityFromTab(tab));

let saveReadingPosition: ReturnType<typeof vi.fn>;

beforeEach(() => {
    saveReadingPosition = vi.fn(async () => undefined);
    vi.stubGlobal('api', {
        documents: {
            saveReadingPosition,
            getReadingPosition: vi.fn(async () => null),
        },
    });
    (window as unknown as { api: unknown }).api = (globalThis as unknown as { api: unknown }).api;
    useAppStore.setState({ rememberReadingPosition: true });
    useTtsStore.setState({ status: 'idle', documentKey: null });
});

afterEach(() => {
    cleanup();
    for (const tab of [sermon, chapterOne, custom])
        clearReadingFinished(readingPositionKeyForTab(tab));
    useDocumentTabsStore.setState({ tabs: [] });
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('readingPositionKeyForTab', () => {
    it('uses the exact key each document view saves under', () => {
        expect(readingPositionKeyForTab(sermon)).toBe(
            resolveSermonScrollPersistence(sermon, null).readingPositionKey,
        );
        expect(readingPositionKeyForTab(custom)).toBe(
            resolveCustomDocumentScrollPersistence('doc-1').readingPositionKey,
        );
        expect(readingPositionKeyForTab(chapterOne)).toBe(
            resolveBibleScrollPersistence('GEN', '1', null, 'LSG').readingPositionKey,
        );
    });
});

describe('readingPositionKeyForDocumentKey', () => {
    it('gives the same key from the read-aloud key as from the tab', () => {
        for (const tab of [sermon, chapterOne, custom]) {
            expect(readingPositionKeyForDocumentKey(keyOf(tab))).toBe(
                readingPositionKeyForTab(tab),
            );
        }
    });

    it('has no key for something it does not know', () => {
        expect(readingPositionKeyForDocumentKey('notes:1')).toBeNull();
        expect(readingPositionKeyForDocumentKey('sermon:fr')).toBeNull();
    });
});

describe('resetFinishedDocument', () => {
    it('saves the start as the reading position of the document read to its end', () => {
        useDocumentTabsStore.setState({ tabs: [sermon] });
        resetFinishedDocument(keyOf(sermon));
        expect(saveReadingPosition).toHaveBeenCalledExactlyOnceWith(
            readingPositionKeyForTab(sermon),
            0,
        );
        expect(isReadingFinished(readingPositionKeyForTab(sermon))).toBe(true);
    });

    it('works for a document in a tab that is not the active one', () => {
        useDocumentTabsStore.setState({
            tabs: [{ ...custom, active: false, scrollY: 0.97 }, { ...sermon }],
        });
        resetFinishedDocument(keyOf(custom));
        expect(saveReadingPosition).toHaveBeenCalledWith(readingPositionKeyForTab(custom), 0);
        expect(useDocumentTabsStore.getState().tabs[0].scrollY).toBe(0);
    });

    it('leaves a tab without its own position alone, so the open view does not jump', () => {
        useDocumentTabsStore.setState({ tabs: [chapterOne] });
        resetFinishedDocument(keyOf(chapterOne));
        expect(useDocumentTabsStore.getState().tabs[0].scrollY).toBeUndefined();
    });

    it('saves nothing when reading positions are not remembered', () => {
        useAppStore.setState({ rememberReadingPosition: false });
        useDocumentTabsStore.setState({ tabs: [sermon] });
        resetFinishedDocument(keyOf(sermon));
        expect(saveReadingPosition).not.toHaveBeenCalled();
    });

    it('still resets a document whose tab has moved on to another one', () => {
        useDocumentTabsStore.setState({ tabs: [sermon] });
        resetFinishedDocument(keyOf(custom));
        expect(saveReadingPosition).toHaveBeenCalledExactlyOnceWith(
            readingPositionKeyForTab(custom),
            0,
        );
    });

    it('ignores an unknown or missing key', () => {
        resetFinishedDocument('notes:1');
        resetFinishedDocument(null);
        expect(saveReadingPosition).not.toHaveBeenCalled();
    });

    it('counts the position again once the voice reads the document again', () => {
        useDocumentTabsStore.setState({ tabs: [sermon] });
        resetFinishedDocument(keyOf(sermon));
        useTtsStore.setState({ status: 'playing', documentKey: keyOf(sermon) });
        expect(isReadingFinished(readingPositionKeyForTab(sermon))).toBe(false);
        useTtsStore.setState({ status: 'idle', documentKey: null });
        expect(isReadingFinished(readingPositionKeyForTab(sermon))).toBe(false);
    });

    it('stays finished while the voice reads another document', () => {
        useDocumentTabsStore.setState({ tabs: [chapterOne] });
        resetFinishedDocument(keyOf(chapterOne));
        useTtsStore.setState({ status: 'playing', documentKey: 'bible:GEN:2:lsg' });
        expect(isReadingFinished(readingPositionKeyForTab(chapterOne))).toBe(true);
    });
});

function Viewer({ tab }: { tab: DocumentTab }) {
    const ref = useRef<HTMLDivElement>(null);
    useScrollAndZoom(ref, {
        contentReady: true,
        restoreIdentity: tab.documentId,
        readingPositionKey: readingPositionKeyForTab(tab),
    });
    return <div ref={ref} data-testid="scroller" />;
}

function renderViewer(tab: DocumentTab) {
    useDocumentTabsStore.setState({ tabs: [tab] });
    const view = render(<Viewer tab={tab} />);
    const scroller = view.getByTestId('scroller');
    let top = 0;
    Object.defineProperty(scroller, 'offsetParent', { get: () => document.body });
    Object.defineProperty(scroller, 'clientHeight', { value: 400 });
    Object.defineProperty(scroller, 'scrollHeight', { value: 4400 });
    Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => top,
        set: (value: number) => {
            top = value;
        },
    });
    const scrollTo = (value: number) => {
        top = value;
        fireEvent.scroll(scroller);
    };
    return { view, scroller, scrollTo };
}

const lastSaved = () => saveReadingPosition.mock.calls.at(-1)?.[1];

describe('saving the position of a document read to its end', () => {
    it('saves the start when the view leaves it, even though it shows the end', async () => {
        const { view, scrollTo } = renderViewer(chapterOne);
        scrollTo(4000);
        resetFinishedDocument(keyOf(chapterOne));
        view.unmount();
        expect(lastSaved()).toBe(0);
    });

    it('a save queued just before the end saves the start', async () => {
        vi.useFakeTimers();
        const { scrollTo } = renderViewer(sermon);
        scrollTo(4000);
        resetFinishedDocument(keyOf(sermon));
        await act(async () => {
            vi.advanceTimersByTime(600);
        });
        expect(lastSaved()).toBe(0);
    });

    it("follow reading's last glide does not undo it", () => {
        const { view, scrollTo } = renderViewer(sermon);
        resetFinishedDocument(keyOf(sermon));
        scrollTo(3990);
        view.unmount();
        expect(lastSaved()).toBe(0);
    });

    it('the reader scrolling the document again saves where they are', () => {
        const { view, scroller, scrollTo } = renderViewer(custom);
        scrollTo(4000);
        resetFinishedDocument(keyOf(custom));
        noteUserScroll(scroller);
        scrollTo(2000);
        view.unmount();
        expect(lastSaved()).toBe(0.5);
    });

    it('opening it again later saves where the reader goes, like from a search hit', () => {
        useDocumentTabsStore.setState({ tabs: [sermon] });
        resetFinishedDocument(keyOf(sermon));
        const { view, scrollTo } = renderViewer(sermon);
        scrollTo(2000);
        view.unmount();
        expect(lastSaved()).toBe(0.5);
    });

    it('a jump to a paragraph in the open document saves the new place', () => {
        const { view, scroller, scrollTo } = renderViewer(sermon);
        scrollTo(4000);
        resetFinishedDocument(keyOf(sermon));
        noteUserJump(scroller);
        scrollTo(1000);
        view.unmount();
        resumeFollowing(scroller);
        expect(lastSaved()).toBe(0.25);
    });

    it('the hold ends once the view has saved the start', () => {
        const first = renderViewer(sermon);
        first.scrollTo(4000);
        resetFinishedDocument(keyOf(sermon));
        first.view.unmount();
        expect(isReadingFinished(readingPositionKeyForTab(sermon))).toBe(false);
    });

    it('a document stopped in the middle keeps its place', () => {
        const { view, scrollTo } = renderViewer(sermon);
        scrollTo(2000);
        view.unmount();
        expect(lastSaved()).toBe(0.5);
    });
});
