// @vitest-environment jsdom
import { createElement, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import {
    SCROLL_SETTLE_MS,
    decideFollow,
    measureFollowGeometry,
    planFollowScroll,
    spokenOnScreen,
    useUserScrollTracking,
} from '@renderer/views/document-view/follow-reading';
import {
    followPause,
    msSinceUserScroll,
    noteUserJump,
    noteUserScroll,
    resumeFollowing,
} from '@renderer/utils/user-scroll';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';
import { useTtsStore } from '@renderer/stores/tts.store';

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

const viewport = { top: 100, bottom: 500 };

describe('planFollowScroll: a paragraph that fits', () => {
    const paragraph = { top: 600, bottom: 700 };

    it('centres the paragraph when the reading reaches it, as before', () => {
        expect(planFollowScroll({ viewport, paragraph, sentence: paragraph }, 'paragraph')).toBe(
            350,
        );
    });

    it('leaves the view alone while the next sentence of a visible paragraph is shown', () => {
        const shown = { top: 200, bottom: 300 };
        const sentence = { top: 260, bottom: 290 };
        expect(planFollowScroll({ viewport, paragraph: shown, sentence }, 'segment')).toBeNull();
    });

    it('brings the paragraph back when its sentence is out of view', () => {
        const sentence = { top: 650, bottom: 680 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBe(350);
    });

    it('does not move for less than two pixels', () => {
        const centred = { top: 251, bottom: 351 };
        expect(
            planFollowScroll({ viewport, paragraph: centred, sentence: centred }, 'paragraph'),
        ).toBeNull();
    });
});

describe('planFollowScroll: a paragraph taller than the view', () => {
    const paragraph = { top: 0, bottom: 2000 };

    it('keeps a sentence between the reading line and the look-ahead line where it is', () => {
        const sentence = { top: 200, bottom: 260 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBeNull();
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'paragraph')).toBeNull();
    });

    it('moves a sentence past the look-ahead line up to the reading line', () => {
        const sentence = { top: 400, bottom: 440 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBe(220);
    });

    it('moves a sentence above the view down to the reading line', () => {
        const sentence = { top: -300, bottom: -260 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBe(-480);
    });

    it('shows the start of the paragraph instead of its middle when the reading reaches it', () => {
        const tall = { top: 450, bottom: 2450 };
        const firstSentence = { top: 450, bottom: 500 };
        const delta = planFollowScroll(
            { viewport, paragraph: tall, sentence: firstSentence },
            'paragraph',
        );
        expect(delta).toBe(270);
        expect(firstSentence.top - delta!).toBe(viewport.top + 400 * 0.2);
    });

    it('uses the paragraph start while a segment has no text in it', () => {
        const tall = { top: 900, bottom: 2900 };
        expect(planFollowScroll({ viewport, paragraph: tall, sentence: null }, 'paragraph')).toBe(
            720,
        );
    });

    it('keeps the place when a later sentence has no mark of its own', () => {
        const tall = { top: -900, bottom: 1100 };
        expect(
            planFollowScroll({ viewport, paragraph: tall, sentence: null }, 'segment'),
        ).toBeNull();
    });

    it('puts the start of a sentence taller than the reading zone just under the top', () => {
        const sentence = { top: 700, bottom: 1500 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBe(568);
    });

    it('leaves a tall sentence alone once its start is shown near the top', () => {
        const sentence = { top: 150, bottom: 950 };
        expect(planFollowScroll({ viewport, paragraph, sentence }, 'segment')).toBeNull();
    });

    it('treats a paragraph that only fits without margins as tall', () => {
        const almost = { top: 100, bottom: 495 };
        const sentence = { top: 450, bottom: 490 };
        expect(planFollowScroll({ viewport, paragraph: almost, sentence }, 'segment')).toBe(270);
    });

    it('leaves the view alone when it has no height (hidden panel)', () => {
        const hidden = { top: 0, bottom: 0 };
        expect(
            planFollowScroll(
                { viewport: hidden, paragraph, sentence: { top: 10, bottom: 20 } },
                'segment',
            ),
        ).toBeNull();
    });
});

function rect(top: number, bottom: number): DOMRect {
    return {
        top,
        bottom,
        left: 0,
        right: 0,
        width: 0,
        height: bottom - top,
        x: 0,
        y: top,
    } as DOMRect;
}

function paragraphWithContent(parts: (string | { mark: string; className: string })[]) {
    const scroller = document.createElement('div');
    const paragraph = document.createElement('p');
    const content = document.createElement('span');
    content.className = 'paragraph-content';
    for (const part of parts) {
        if (typeof part === 'string') {
            content.append(part);
        } else {
            const mark = document.createElement('mark');
            mark.className = part.className;
            mark.textContent = part.mark;
            content.append(mark);
        }
    }
    paragraph.append(content);
    scroller.append(paragraph);
    Object.defineProperty(scroller, 'clientHeight', { value: 380 });
    scroller.getBoundingClientRect = () => rect(100, 500);
    paragraph.getBoundingClientRect = () => rect(150, 900);
    return { scroller, paragraph };
}

describe('measureFollowGeometry', () => {
    afterEach(removeRangeRects);

    it('measures the spoken characters, even inside a saved highlight that hides the mark', () => {
        const { scroller, paragraph } = paragraphWithContent([
            'One. ',
            { mark: 'Two. Three.', className: '' },
            ' Four.',
        ]);
        const spoken: string[] = [];
        stubRangeRects(function (this: Range) {
            spoken.push(this.toString());
            return [rect(300, 330), rect(330, 360)] as unknown as DOMRectList;
        });

        const geometry = measureFollowGeometry(scroller, paragraph, { start: 5, end: 9 });

        expect(spoken).toEqual(['Two.']);
        expect(geometry).toEqual({
            viewport: { top: 100, bottom: 480 },
            paragraph: { top: 150, bottom: 900 },
            sentence: { top: 300, bottom: 360 },
        });
    });

    it('spans text split across several nodes', () => {
        const { scroller, paragraph } = paragraphWithContent([
            'One. Tw',
            { mark: 'o. Thr', className: '' },
            'ee.',
        ]);
        const spoken: string[] = [];
        stubRangeRects(function (this: Range) {
            spoken.push(this.toString());
            return [rect(10, 20)] as unknown as DOMRectList;
        });
        measureFollowGeometry(scroller, paragraph, { start: 5, end: 16 });
        expect(spoken).toEqual(['Two. Three.']);
    });

    it('falls back to the spoken marks when the text cannot be measured', () => {
        const { scroller, paragraph } = paragraphWithContent([
            { mark: 'One.', className: 'tts-active-sentence' },
            { mark: ' Two.', className: 'tts-active-sentence' },
        ]);
        const [first, second] = paragraph.querySelectorAll('mark');
        first.getBoundingClientRect = () => rect(300, 330);
        second.getBoundingClientRect = () => rect(330, 390);
        stubRangeRects(() => [] as unknown as DOMRectList);

        expect(measureFollowGeometry(scroller, paragraph, { start: 0, end: 9 }).sentence).toEqual({
            top: 300,
            bottom: 390,
        });
    });

    it('has no sentence for an announcement with an empty range and no mark', () => {
        const { scroller, paragraph } = paragraphWithContent(['One. Two.']);
        expect(
            measureFollowGeometry(scroller, paragraph, { start: 0, end: 0 }).sentence,
        ).toBeNull();
        expect(measureFollowGeometry(scroller, paragraph, null).sentence).toBeNull();
    });
});

describe('scrollToParagraph', () => {
    it('counts a jump to a paragraph as the reader moving the view', () => {
        const container = document.createElement('div');
        const target = document.createElement('p');
        target.dataset.paragraphIndex = '7';
        container.append(target);
        expect(scrollToParagraph(container, 7)).toBe(true);
        expect(followPause(container)).toBe('jump');
    });
});

describe('what the reader did', () => {
    it('records a scroll, and a jump that a later scroll does not weaken', () => {
        const scroller = document.createElement('div');
        expect(followPause(scroller)).toBeNull();
        expect(msSinceUserScroll(scroller, 5_000)).toBe(Infinity);

        noteUserScroll(scroller, 1_000);
        expect(followPause(scroller)).toBe('scroll');
        expect(msSinceUserScroll(scroller, 1_300)).toBe(300);

        noteUserJump(scroller);
        noteUserScroll(scroller, 2_000);
        expect(followPause(scroller)).toBe('jump');

        resumeFollowing(scroller);
        expect(followPause(scroller)).toBeNull();
    });
});

describe('decideFollow', () => {
    const base = {
        pause: null,
        msSinceScroll: Infinity,
        reason: 'segment' as const,
        explicit: false,
        onScreen: false,
        locked: false,
    };

    it('follows when the reader did nothing', () => {
        expect(decideFollow(base)).toEqual({ follow: true, resume: false });
    });

    it('waits inside the paragraph after the reader scrolled away', () => {
        expect(decideFollow({ ...base, pause: 'scroll', msSinceScroll: 60_000 })).toEqual({
            follow: false,
            retryInMs: null,
        });
    });

    it('follows again at the next paragraph once the wheel has settled', () => {
        const next = { ...base, pause: 'scroll' as const, reason: 'paragraph' as const };
        expect(decideFollow({ ...next, msSinceScroll: 500 })).toEqual({
            follow: false,
            retryInMs: SCROLL_SETTLE_MS - 500,
        });
        expect(decideFollow({ ...next, msSinceScroll: SCROLL_SETTLE_MS })).toEqual({
            follow: true,
            resume: true,
        });
    });

    it('stays where the reader jumped, even at the next paragraph', () => {
        const jumped = { ...base, pause: 'jump' as const, msSinceScroll: 60_000 };
        expect(decideFollow(jumped)).toEqual({ follow: false, retryInMs: null });
        expect(decideFollow({ ...jumped, reason: 'paragraph' })).toEqual({
            follow: false,
            retryInMs: null,
        });
    });

    it('follows again as soon as the spoken text is back on screen', () => {
        expect(decideFollow({ ...base, pause: 'jump', onScreen: true })).toEqual({
            follow: true,
            resume: true,
        });
    });

    it('follows when the reader turns it on or comes back to the document', () => {
        expect(decideFollow({ ...base, pause: 'jump', explicit: true })).toEqual({
            follow: true,
            resume: true,
        });
    });

    it('waits while a context menu holds the view, then tries again', () => {
        expect(decideFollow({ ...base, locked: true, explicit: true })).toEqual({
            follow: false,
            retryInMs: 500,
        });
    });
});

describe('spokenOnScreen', () => {
    const paragraph = { top: 0, bottom: 2000 };

    it('counts a sentence partly in view', () => {
        expect(spokenOnScreen({ viewport, paragraph, sentence: { top: 480, bottom: 520 } })).toBe(
            true,
        );
    });

    it('does not count a sentence below or above the view', () => {
        expect(spokenOnScreen({ viewport, paragraph, sentence: { top: 500, bottom: 540 } })).toBe(
            false,
        );
        expect(spokenOnScreen({ viewport, paragraph, sentence: { top: 40, bottom: 100 } })).toBe(
            false,
        );
    });

    it('uses the paragraph start for an announcement', () => {
        expect(
            spokenOnScreen({ viewport, paragraph: { top: 300, bottom: 900 }, sentence: null }),
        ).toBe(true);
        expect(spokenOnScreen({ viewport, paragraph, sentence: null })).toBe(false);
    });
});

const paused = (scroller: Element) => followPause(scroller) !== null;

function Tracked({ active }: { active: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useUserScrollTracking(ref, active);
    return createElement(
        'div',
        { ref, 'data-testid': 'scroller' },
        createElement('input', { 'data-testid': 'field' }),
        createElement('p', { tabIndex: 0, 'data-testid': 'text' }, 'text'),
    );
}

function renderTracked(active = true) {
    const rendered = render(createElement(Tracked, { active }));
    const view = within(rendered.container);
    const scroller = view.getByTestId('scroller');
    let shown = true;
    Object.defineProperty(scroller, 'offsetParent', {
        configurable: true,
        get: () => (shown ? document.body : null),
    });
    Object.defineProperty(scroller, 'clientWidth', { value: 300 });
    const hide = () => {
        shown = false;
    };
    return { view, scroller, hide, unmount: rendered.unmount };
}

function press(target: Element, key: string, handled = false) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    if (handled) event.preventDefault();
    target.dispatchEvent(event);
}

function pointerDown(target: Element, offsetX: number) {
    const event = new MouseEvent('pointerdown', { bubbles: true }) as PointerEvent;
    Object.defineProperty(event, 'offsetX', { value: offsetX });
    target.dispatchEvent(event);
}

describe('useUserScrollTracking', () => {
    afterEach(() => {
        cleanup();
        useTtsStore.setState({ status: 'idle', documentKey: null, currentSegmentIndex: 0 });
    });

    it('counts the wheel and touch as the reader scrolling', () => {
        const { scroller } = renderTracked();
        scroller.dispatchEvent(new Event('wheel'));
        expect(paused(scroller)).toBe(true);

        const touched = renderTracked().scroller;
        touched.dispatchEvent(new Event('touchmove'));
        expect(paused(touched)).toBe(true);
    });

    it('counts a drag on the scrollbar but not a click on the text', () => {
        const { scroller, view } = renderTracked();
        pointerDown(view.getByTestId('text'), 10);
        expect(paused(scroller)).toBe(false);
        pointerDown(scroller, 120);
        expect(paused(scroller)).toBe(false);
        pointerDown(scroller, 305);
        expect(paused(scroller)).toBe(true);
    });

    it('counts drag-selecting and middle-click autoscroll, not a plain hover', () => {
        const { scroller } = renderTracked();
        const move = (buttons: number) => {
            const event = new MouseEvent('pointermove', { bubbles: true }) as PointerEvent;
            Object.defineProperty(event, 'buttons', { value: buttons });
            scroller.dispatchEvent(event);
        };
        move(0);
        expect(paused(scroller)).toBe(false);
        move(1);
        expect(paused(scroller)).toBe(true);

        const other = renderTracked().scroller;
        const middle = new MouseEvent('pointerdown', { bubbles: true, button: 1 }) as PointerEvent;
        Object.defineProperty(middle, 'offsetX', { value: 10 });
        other.dispatchEvent(middle);
        expect(paused(other)).toBe(true);
    });

    it('counts scroll keys in the document, but not typing or keys another shortcut used', () => {
        const { scroller, view } = renderTracked();
        press(view.getByTestId('field'), 'PageDown');
        press(view.getByTestId('text'), ' ', true);
        press(view.getByTestId('text'), 'a');
        expect(paused(scroller)).toBe(false);

        press(view.getByTestId('text'), 'PageDown');
        expect(paused(scroller)).toBe(true);
    });

    it('counts scroll keys pressed with nothing focused', () => {
        const { scroller } = renderTracked();
        press(document.body, 'ArrowDown');
        expect(paused(scroller)).toBe(true);
    });

    it('ignores keys while the document is hidden', () => {
        const { scroller, hide } = renderTracked();
        hide();
        press(document.body, 'End');
        expect(paused(scroller)).toBe(false);
    });

    it('follows again as soon as playback starts or resumes', () => {
        const { scroller } = renderTracked();
        useTtsStore.setState({ status: 'paused' });
        scroller.dispatchEvent(new Event('wheel'));
        useTtsStore.setState({ status: 'playing' });
        expect(paused(scroller)).toBe(false);
    });

    it('follows again when the reader skips or goes back', () => {
        const { scroller } = renderTracked();
        useTtsStore.setState({ status: 'playing', documentKey: 'doc', currentSegmentIndex: 3 });
        scroller.dispatchEvent(new Event('wheel'));
        useTtsStore.setState({ currentSegmentIndex: 4 });
        expect(paused(scroller)).toBe(true);
        useTtsStore.setState({ currentSegmentIndex: 9 });
        expect(paused(scroller)).toBe(false);

        scroller.dispatchEvent(new Event('wheel'));
        useTtsStore.setState({ currentSegmentIndex: 8 });
        expect(paused(scroller)).toBe(false);
    });

    it('keeps the wait when playback simply goes on', () => {
        const { scroller } = renderTracked();
        useTtsStore.setState({ status: 'playing' });
        scroller.dispatchEvent(new Event('wheel'));
        useTtsStore.setState({ status: 'loading' });
        expect(paused(scroller)).toBe(true);
    });

    it('listens to nothing while the document is not shown, and stops after unmount', () => {
        const { scroller } = renderTracked(false);
        scroller.dispatchEvent(new Event('wheel'));
        expect(paused(scroller)).toBe(false);

        const mounted = renderTracked();
        mounted.unmount();
        mounted.scroller.dispatchEvent(new Event('wheel'));
        expect(paused(mounted.scroller)).toBe(false);
    });
});
