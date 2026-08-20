import { beforeEach, describe, expect, it } from 'vitest';
import { selectCanResume, selectLastPosition, useTtsStore } from '@renderer/stores/tts.store';

const initial = useTtsStore.getState();

function setState(partial: Partial<ReturnType<typeof useTtsStore.getState>>) {
    useTtsStore.setState(partial);
    return useTtsStore.getState();
}

describe('selectLastPosition', () => {
    beforeEach(() => {
        useTtsStore.setState(initial, true);
    });

    it('reports the live position while playing', () => {
        const state = setState({
            documentKey: 'sermon:63-0101:1:fr',
            status: 'playing',
            currentSegmentIndex: 12,
        });

        expect(selectLastPosition(state)).toEqual({
            documentKey: 'sermon:63-0101:1:fr',
            segmentIndex: 12,
        });
    });

    it('reports the live position while paused', () => {
        const state = setState({
            documentKey: 'sermon:63-0101:1:fr',
            status: 'paused',
            currentSegmentIndex: 3,
        });

        expect(selectLastPosition(state)?.segmentIndex).toBe(3);
    });

    it('falls back to the remembered position once playback stops', () => {
        setState({
            documentKey: 'sermon:63-0101:1:fr',
            status: 'playing',
            currentSegmentIndex: 7,
        });
        useTtsStore.getState().stopAndRemember();

        expect(selectLastPosition(useTtsStore.getState())).toEqual({
            documentKey: 'sermon:63-0101:1:fr',
            segmentIndex: 7,
        });
    });

    it('reports nothing after a document finishes naturally', () => {
        setState({
            documentKey: 'sermon:63-0101:1:fr',
            status: 'playing',
            currentSegmentIndex: 9,
        });
        useTtsStore.getState().markCompletedNaturally();
        setState({ status: 'idle', documentKey: null });

        expect(selectLastPosition(useTtsStore.getState())).toBeNull();
    });

    it('reports nothing when a stop happened at the very beginning', () => {
        const state = setState({
            status: 'idle',
            documentKey: null,
            lastStoppedDocumentKey: 'sermon:63-0101:1:fr',
            lastStoppedSegmentIndex: 0,
        });

        expect(selectLastPosition(state)).toBeNull();
    });

    it('reports nothing when nothing has played', () => {
        expect(selectLastPosition(useTtsStore.getState())).toBeNull();
    });
});

describe('restoreLastPosition', () => {
    beforeEach(() => {
        useTtsStore.setState(initial, true);
    });

    it('seeds the resume point read back from persistence', () => {
        useTtsStore
            .getState()
            .restoreLastPosition({ documentKey: 'sermon:65-1212:3:fr', segmentIndex: 42 });

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBe('sermon:65-1212:3:fr');
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(42);
    });

    it('clears the resume point when nothing was persisted', () => {
        useTtsStore.setState({
            lastStoppedDocumentKey: 'sermon:65-1212:3:fr',
            lastStoppedSegmentIndex: 42,
        });

        useTtsStore.getState().restoreLastPosition(null);

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBeNull();
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(0);
    });

    it('is overwritten by the next document that plays', () => {
        useTtsStore
            .getState()
            .restoreLastPosition({ documentKey: 'sermon:65-1212:3:fr', segmentIndex: 42 });

        setState({
            documentKey: 'sermon:63-0101:1:fr',
            status: 'playing',
            currentSegmentIndex: 2,
        });

        expect(selectLastPosition(useTtsStore.getState())).toEqual({
            documentKey: 'sermon:63-0101:1:fr',
            segmentIndex: 2,
        });
    });
});

describe('selectCanResume', () => {
    const DOC = 'sermon:63-0101:1:fr';
    const OTHER = 'sermon:65-1212:3:fr';

    beforeEach(() => {
        useTtsStore.setState(initial, true);
    });

    it('is true for the document holding the saved position while nothing plays', () => {
        setState({ lastStoppedDocumentKey: DOC, lastStoppedSegmentIndex: 12 });

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(true);
    });

    it('is false while another document holds the session', () => {
        setState({
            lastStoppedDocumentKey: DOC,
            lastStoppedSegmentIndex: 12,
            documentKey: OTHER,
            status: 'playing',
        });

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });

    it('is false while another document is merely paused', () => {
        setState({
            lastStoppedDocumentKey: DOC,
            lastStoppedSegmentIndex: 12,
            documentKey: OTHER,
            status: 'paused',
        });

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });

    it('is false for the document that is itself playing', () => {
        setState({
            lastStoppedDocumentKey: DOC,
            lastStoppedSegmentIndex: 12,
            documentKey: DOC,
            status: 'playing',
        });

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });

    it('is false for a document with no saved position', () => {
        setState({ lastStoppedDocumentKey: DOC, lastStoppedSegmentIndex: 12 });

        expect(selectCanResume(useTtsStore.getState(), OTHER)).toBe(false);
    });

    it('is false when the saved position is the very beginning', () => {
        setState({ lastStoppedDocumentKey: DOC, lastStoppedSegmentIndex: 0 });

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });

    it('becomes true again once the other document releases the session', () => {
        setState({ documentKey: OTHER, status: 'playing', currentSegmentIndex: 4 });
        useTtsStore.getState().stopAndRemember();

        expect(selectCanResume(useTtsStore.getState(), OTHER)).toBe(true);
        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });
});

describe('the resume slot follows the played document', () => {
    const DOC = 'sermon:63-0101:1:fr';
    const OTHER = 'sermon:65-1212:3:fr';

    function play(documentKey: string, segmentIndex: number) {
        useTtsStore.getState().setDocumentKey(documentKey);
        useTtsStore.getState().setPlaybackState({
            status: 'playing',
            currentSegmentIndex: segmentIndex,
            totalSegments: 100,
            provider: 'sherpa',
        });
    }

    beforeEach(() => {
        useTtsStore.setState(initial, true);
    });

    it('claims the slot as soon as a document starts playing', () => {
        play(DOC, 0);

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBe(DOC);
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(0);
    });

    it('drops another document position the moment a new one plays', () => {
        setState({ lastStoppedDocumentKey: DOC, lastStoppedSegmentIndex: 40 });
        play(OTHER, 2);

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBe(OTHER);
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(2);
        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(false);
    });

    it('tracks the position as playback advances', () => {
        play(DOC, 0);
        play(DOC, 7);

        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(7);
    });

    it('leaves the slot alone when no document holds the session', () => {
        setState({ lastStoppedDocumentKey: DOC, lastStoppedSegmentIndex: 40 });
        useTtsStore.getState().setPlaybackState({
            status: 'playing',
            currentSegmentIndex: 3,
            totalSegments: 10,
            provider: 'sherpa',
        });

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBe(DOC);
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(40);
    });

    it('survives the stop that releases the session', () => {
        play(DOC, 12);
        useTtsStore.getState().stopAndRemember();

        expect(selectCanResume(useTtsStore.getState(), DOC)).toBe(true);
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(12);
    });

    it('is cleared when the document finishes on its own', () => {
        play(DOC, 99);
        useTtsStore.getState().markCompletedNaturally();

        expect(useTtsStore.getState().lastStoppedDocumentKey).toBeNull();
        expect(useTtsStore.getState().lastStoppedSegmentIndex).toBe(0);
    });
});
