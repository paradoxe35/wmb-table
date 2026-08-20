import { beforeEach, describe, expect, it } from 'vitest';
import { selectLastPosition, useTtsStore } from '@renderer/stores/tts.store';

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
