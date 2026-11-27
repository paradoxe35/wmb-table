// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TtsSegment, TtsSettings } from '@shared/tts.types';
import '@renderer/i18n';
import { useAppStore } from '@renderer/stores/app.store';
import { useTtsStore } from '@renderer/stores/tts.store';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { ParagraphList } from '@renderer/views/document-view/tts-controls';
import { followPause, noteUserJump, noteUserScroll } from '@renderer/utils/user-scroll';
import { SCROLL_SETTLE_MS } from '@renderer/views/document-view/follow-reading';
import type { HighlightItem } from '@shared/types';

/** jsdom has no layout, so `Range.getClientRects` is missing; the tests give it one. */
function stubRangeRects(measure: (this: Range) => DOMRectList): void {
    Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        writable: true,
        value: measure,
    });
}

function removeRangeRects(): void {
    delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
}

const DOCUMENT_KEY = 'sermon:test';
const LONG = 'One. Two. Three. Four.';
const paragraphs = [
    { paragraphIndex: 1, content: 'Short paragraph.' },
    { paragraphIndex: 2, content: LONG },
];

const segments: TtsSegment[] = [
    { index: 0, text: 'Short paragraph.', paragraphIndex: 1, startOffset: 0, endOffset: 16 },
    { index: 1, text: '', paragraphIndex: 2, startOffset: 0, endOffset: 0 },
    { index: 2, text: 'One.', paragraphIndex: 2, startOffset: 0, endOffset: 4 },
    { index: 3, text: 'Two.', paragraphIndex: 2, startOffset: 5, endOffset: 9 },
    { index: 4, text: 'Three.', paragraphIndex: 2, startOffset: 10, endOffset: 16 },
];

/** Viewport 100–500; the short paragraph fits, the long one is 2000 px tall. */
const layout = {
    paragraphs: {
        1: { top: 600, bottom: 700 },
        2: { top: 450, bottom: 2450 },
    } as Record<number, { top: number; bottom: number }>,
    sentence: { top: 450, bottom: 500 },
};

function box(top: number, bottom: number): DOMRect {
    return {
        top,
        bottom,
        left: 0,
        right: 0,
        x: 0,
        y: top,
        width: 0,
        height: bottom - top,
    } as DOMRect;
}

let scrollBy: ReturnType<typeof vi.fn>;
let scroller: HTMLElement;
let reducedMotion = false;

function renderList(highlightsByParagraph = new Map<number, HighlightItem[]>()) {
    const view = render(
        <div id={DOCUMENT_CONTAINER_ID}>
            <ParagraphList
                paragraphs={paragraphs}
                documentKey={DOCUMENT_KEY}
                documentIdentity={null}
                search={null}
                activeParagraphIndex={-1}
                highlightsByParagraph={highlightsByParagraph}
            />
        </div>,
    );
    scroller = view.container.querySelector(`#${DOCUMENT_CONTAINER_ID}`)!;
    Object.defineProperty(scroller, 'clientHeight', { value: 400 });
    scroller.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
    return view;
}

/** React may commit after the first tick, and the scroll runs one frame later. */
const nextFrames = () => new Promise((resolve) => setTimeout(resolve, 20));

async function playSegment(index: number, status: 'playing' | 'loading' = 'playing') {
    await act(async () => {
        useTtsStore.setState({ status, currentSegmentIndex: index });
        await nextFrames();
    });
}

beforeEach(() => {
    scrollBy = vi.fn();
    reducedMotion = false;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({ matches: reducedMotion && query.includes('reduce') }) as MediaQueryList,
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
    ) {
        if (this.id === DOCUMENT_CONTAINER_ID) return box(100, 500);
        if (this.classList.contains('tts-active-sentence')) {
            return box(layout.sentence.top, layout.sentence.bottom);
        }
        const index = Number(
            this.querySelector('[data-paragraph-index]')?.getAttribute('data-paragraph-index'),
        );
        const paragraph = layout.paragraphs[index];
        return paragraph ? box(paragraph.top, paragraph.bottom) : box(0, 0);
    });
    useAppStore.setState({ mainView: 'document' });
    useTtsStore.setState({
        documentKey: DOCUMENT_KEY,
        status: 'idle',
        segments,
        totalSegments: segments.length,
        currentSegmentIndex: 0,
        settings: { autoScrollToHighlight: true } as TtsSettings,
    });
    layout.sentence = { top: 450, bottom: 500 };
});

afterEach(() => {
    cleanup();
    removeRangeRects();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('follow reading in the document', () => {
    it('centres a paragraph that fits when the reading reaches it, instantly as before', async () => {
        renderList();
        layout.sentence = { top: 600, bottom: 700 };
        await playSegment(0);
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 350, behavior: 'instant' });
    });

    it('shows the start of a long paragraph, not its middle, then follows each sentence', async () => {
        renderList();
        await playSegment(1);
        expect(scrollBy).toHaveBeenLastCalledWith({ top: 270, behavior: 'instant' });

        layout.sentence = { top: 180, bottom: 220 };
        await playSegment(2);
        layout.sentence = { top: 300, bottom: 340 };
        await playSegment(3);
        expect(scrollBy).toHaveBeenCalledTimes(1);

        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(4);
        expect(scrollBy).toHaveBeenLastCalledWith({ top: 260, behavior: 'smooth' });
    });

    it('jumps instead of gliding when the system asks for reduced motion', async () => {
        reducedMotion = true;
        renderList();
        await playSegment(2);
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        expect(scrollBy).toHaveBeenLastCalledWith({ top: 260, behavior: 'instant' });
    });

    it('does not pull the reader back inside the paragraph after they scroll away', async () => {
        renderList();
        await playSegment(2);
        scrollBy.mockClear();
        noteUserScroll(scroller);
        layout.sentence = { top: 900, bottom: 940 };
        await playSegment(3);
        await playSegment(4);
        expect(scrollBy).not.toHaveBeenCalled();
    });

    it('follows again when the spoken sentence is back on screen', async () => {
        renderList();
        await playSegment(2);
        scrollBy.mockClear();
        noteUserJump(scroller);
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 260, behavior: 'smooth' });
        expect(followPause(scroller)).toBeNull();
    });

    it('follows at the next paragraph once the wheel has settled', async () => {
        renderList();
        layout.sentence = { top: 900, bottom: 1000 };
        layout.paragraphs[1] = { top: 900, bottom: 1000 };
        await playSegment(4);
        scrollBy.mockClear();
        noteUserScroll(scroller, performance.now() - SCROLL_SETTLE_MS + 150);
        await playSegment(0);
        expect(scrollBy).not.toHaveBeenCalled();

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 300));
        });
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 650, behavior: 'instant' });
        layout.paragraphs[1] = { top: 600, bottom: 700 };
    });

    it('stays where the reader jumped, even at the next paragraph', async () => {
        renderList();
        await playSegment(4);
        scrollBy.mockClear();
        noteUserJump(scroller);
        layout.sentence = { top: 900, bottom: 1000 };
        layout.paragraphs[1] = { top: 900, bottom: 1000 };
        await playSegment(0);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS + 100));
        });
        expect(scrollBy).not.toHaveBeenCalled();
        layout.paragraphs[1] = { top: 600, bottom: 700 };
    });

    it('waits while the context menu is open, then follows', async () => {
        renderList();
        await playSegment(2);
        scrollBy.mockClear();
        scroller.dataset.scrollLocked = 'true';
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        expect(scrollBy).not.toHaveBeenCalled();

        delete scroller.dataset.scrollLocked;
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 650));
        });
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 260, behavior: 'smooth' });
    });

    it('does not follow later once playback stops', async () => {
        renderList();
        await playSegment(2);
        scrollBy.mockClear();
        scroller.dataset.scrollLocked = 'true';
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        await act(async () => {
            useTtsStore.setState({ status: 'idle' });
            delete scroller.dataset.scrollLocked;
            await new Promise((resolve) => setTimeout(resolve, 650));
        });
        expect(scrollBy).not.toHaveBeenCalled();
    });

    it('does nothing when follow reading is off', async () => {
        useTtsStore.setState({ settings: { autoScrollToHighlight: false } as TtsSettings });
        renderList();
        await playSegment(2);
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        expect(scrollBy).not.toHaveBeenCalled();
    });

    it('follows as soon as it is turned on, even right after a manual scroll', async () => {
        useTtsStore.setState({ settings: { autoScrollToHighlight: false } as TtsSettings });
        renderList();
        await playSegment(2);
        noteUserScroll(scroller);
        layout.sentence = { top: 440, bottom: 480 };
        await act(async () => {
            useTtsStore.setState({ settings: { autoScrollToHighlight: true } as TtsSettings });
            await nextFrames();
        });
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 260, behavior: 'instant' });
    });

    it('waits while another view is shown, then aligns on return', async () => {
        useAppStore.setState({ mainView: 'options' as never });
        renderList();
        await playSegment(2);
        layout.sentence = { top: 440, bottom: 480 };
        await playSegment(3);
        expect(scrollBy).not.toHaveBeenCalled();

        await act(async () => {
            useAppStore.setState({ mainView: 'document' });
            await nextFrames();
        });
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 260, behavior: 'instant' });
    });

    it('follows a sentence hidden under a saved highlight by measuring its text', async () => {
        const covering = {
            id: 'h1',
            paragraphIndex: 2,
            startOffset: 0,
            endOffset: LONG.length,
            color: '#ffeb3b',
        } as HighlightItem;
        stubRangeRects(function (this: Range) {
            const positions: Record<string, [number, number]> = {
                'One.': [180, 220],
                'Two.': [440, 480],
            };
            const at = positions[this.toString()];
            return (at ? [box(...at)] : []) as unknown as DOMRectList;
        });
        renderList(new Map([[2, [covering]]]));
        await playSegment(2);
        expect(scrollBy).not.toHaveBeenCalled();

        await playSegment(3);
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 260, behavior: 'smooth' });
    });

    it('keeps the view while paused and while the next segment loads in the same place', async () => {
        renderList();
        await playSegment(2);
        layout.sentence = { top: 180, bottom: 230 };
        scrollBy.mockClear();
        await act(async () => {
            useTtsStore.setState({ status: 'paused' });
            await nextFrames();
        });
        await playSegment(2, 'loading');
        await playSegment(2);
        expect(scrollBy).not.toHaveBeenCalled();
    });
});
