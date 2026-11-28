import { type RefObject, useEffect } from 'react';
import type { TtsPlaybackStatus } from '@shared/tts.types';
import { useTtsStore } from '@renderer/stores/tts.store';
import { type FollowPause, noteUserScroll, resumeFollowing } from '@renderer/utils/user-scroll';

export interface VerticalBox {
    top: number;
    bottom: number;
}

export interface FollowGeometry {
    viewport: VerticalBox;
    paragraph: VerticalBox;
    /** The highlighted sentence; null while a segment has no text in the paragraph (announcements). */
    sentence: VerticalBox | null;
}

/** `paragraph`: the reading just reached this paragraph; `segment`: it moved within it. */
export type FollowReason = 'paragraph' | 'segment';

/** The sentence is placed this far down the viewport, so the lines before it stay readable. */
const READING_LINE = 0.2;
/** Past this line the reader would lose the next lines, so the view moves. */
const LOOK_AHEAD_LINE = 0.8;
const MIN_SCROLL_PX = 2;

function edgeMargin(viewportHeight: number): number {
    return Math.min(40, Math.max(8, viewportHeight * 0.08));
}

/**
 * How far to scroll so the spoken text stays readable, or null to leave the view alone.
 * A paragraph that fits is centred, as before; a taller one follows its sentence.
 */
export function planFollowScroll(
    { viewport, paragraph, sentence }: FollowGeometry,
    reason: FollowReason,
): number | null {
    const height = viewport.bottom - viewport.top;
    if (height <= 0) return null;

    // A search mark can cover the whole sentence; jumping to the paragraph start would lose the place
    if (!sentence && reason === 'segment') return null;

    const margin = edgeMargin(height);
    const paragraphHeight = paragraph.bottom - paragraph.top;
    const target = sentence ?? { top: paragraph.top, bottom: paragraph.top };

    const delta = (() => {
        if (paragraphHeight <= height - 2 * margin) {
            const visible = target.top >= viewport.top && target.bottom <= viewport.bottom;
            if (reason === 'segment' && visible) return null;
            const paragraphCentre = (paragraph.top + paragraph.bottom) / 2;
            return paragraphCentre - (viewport.top + viewport.bottom) / 2;
        }

        const topLimit = viewport.top + margin;
        const readingLine = viewport.top + height * READING_LINE;
        const lookAheadLine = viewport.top + height * LOOK_AHEAD_LINE;

        if (target.bottom - target.top > lookAheadLine - readingLine) {
            const startShown = target.top >= topLimit && target.top <= readingLine;
            return startShown ? null : target.top - topLimit;
        }

        const comfortable = target.top >= topLimit && target.bottom <= lookAheadLine;
        return comfortable ? null : target.top - readingLine;
    })();

    return delta == null || Math.abs(delta) < MIN_SCROLL_PX ? null : Math.round(delta);
}

/** A new paragraph waits this long after the last wheel move, so the view never jumps under it. */
export const SCROLL_SETTLE_MS = 1_500;
const LOCKED_RETRY_MS = 500;
/** How often to look again while the view is still gliding to where the reader jumped. */
const JUMP_MOVING_RETRY_MS = 250;

export type FollowDecision =
    { follow: true; resume: boolean } | { follow: false; retryInMs: number | null };

/** The reader can see at least part of the spoken text (or the paragraph start for an announcement). */
export function spokenOnScreen({ viewport, paragraph, sentence }: FollowGeometry): boolean {
    const target = sentence ?? { top: paragraph.top, bottom: paragraph.top + 1 };
    return target.bottom > viewport.top && target.top < viewport.bottom;
}

/** Whether follow reading may move the view now, given what the reader did (see user-scroll.ts). */
export function decideFollow({
    pause,
    msSinceScroll,
    reason,
    explicit,
    onScreen,
    locked,
    jumpMoving,
}: {
    pause: FollowPause | null;
    msSinceScroll: number;
    reason: FollowReason;
    /** Turning follow reading on, or coming back to the document view. */
    explicit: boolean;
    onScreen: boolean;
    /** A context menu holds the view still. */
    locked: boolean;
    /** The view is still on its way to where the reader jumped, maybe over the spoken text. */
    jumpMoving: boolean;
}): FollowDecision {
    if (locked) return { follow: false, retryInMs: LOCKED_RETRY_MS };
    if (explicit || !pause) return { follow: true, resume: pause != null };
    if (pause === 'jump' && jumpMoving) return { follow: false, retryInMs: JUMP_MOVING_RETRY_MS };
    if (onScreen) return { follow: true, resume: true };
    if (pause === 'jump' || reason === 'segment') return { follow: false, retryInMs: null };
    if (msSinceScroll < SCROLL_SETTLE_MS) {
        return { follow: false, retryInMs: SCROLL_SETTLE_MS - msSinceScroll };
    }
    return { follow: true, resume: true };
}

function verticalBox(rect: DOMRect): VerticalBox {
    return { top: rect.top, bottom: rect.bottom };
}

export interface TextSpan {
    start: number;
    end: number;
}

function unionBox(rects: DOMRect[]): VerticalBox | null {
    const shown = rects.filter((rect) => rect.height > 0);
    if (shown.length === 0) return null;
    return {
        top: Math.min(...shown.map((rect) => rect.top)),
        bottom: Math.max(...shown.map((rect) => rect.bottom)),
    };
}

/** Measures the spoken characters themselves: saved or search highlights can hide or cut its mark. */
function measureTextSpan(content: Element, { start, end }: TextSpan): VerticalBox | null {
    const range = document.createRange();
    if (end <= start || typeof range.getClientRects !== 'function') return null;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.textContent?.length ?? 0;
        if (!started && start < offset + length) {
            range.setStart(node, start - offset);
            started = true;
        }
        if (started && end <= offset + length) {
            range.setEnd(node, end - offset);
            return unionBox([...range.getClientRects()]);
        }
        offset += length;
    }
    return null;
}

export function measureFollowGeometry(
    scroller: HTMLElement,
    paragraphElement: HTMLElement,
    spoken: TextSpan | null,
): FollowGeometry {
    const box = scroller.getBoundingClientRect();
    const content = paragraphElement.querySelector('.paragraph-content');
    const fromText = content && spoken ? measureTextSpan(content, spoken) : null;
    const marks = [...paragraphElement.querySelectorAll('.tts-active-sentence')];
    return {
        viewport: { top: box.top, bottom: box.top + scroller.clientHeight },
        paragraph: verticalBox(paragraphElement.getBoundingClientRect()),
        sentence: fromText ?? unionBox(marks.map((mark) => mark.getBoundingClientRect())),
    };
}

const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

function isEditable(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
}

const isReading = (status: TtsPlaybackStatus) => status === 'playing' || status === 'loading';

/**
 * Records wheel, touch, scrollbar, keyboard, drag-selection and middle-click scrolling in the
 * document, never our own scrolls. Starting, resuming or skipping is a request to follow again.
 */
export function useUserScrollTracking(
    scrollerRef: RefObject<HTMLElement | null>,
    active: boolean,
): void {
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!active || !scroller) return;

        const note = () => noteUserScroll(scroller);
        const onPointerDown = (event: PointerEvent) => {
            const onScrollbar = event.target === scroller && event.offsetX > scroller.clientWidth;
            if (onScrollbar || event.button === 1) note();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (event.buttons !== 0) note();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || !SCROLL_KEYS.has(event.key)) return;
            if (isEditable(event.target) || !scroller.offsetParent) return;
            const target = event.target as Node | null;
            if (target === document.body || (target && scroller.contains(target))) note();
        };

        scroller.addEventListener('wheel', note, { passive: true });
        scroller.addEventListener('touchmove', note, { passive: true });
        scroller.addEventListener('pointerdown', onPointerDown);
        scroller.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('keydown', onKeyDown);
        const unsubscribe = useTtsStore.subscribe((state, previous) => {
            const started = isReading(state.status) && !isReading(previous.status);
            const jumped =
                state.documentKey === previous.documentKey &&
                state.currentSegmentIndex !== previous.currentSegmentIndex &&
                state.currentSegmentIndex !== previous.currentSegmentIndex + 1;
            if (started || jumped) {
                resumeFollowing(scroller);
            }
        });
        return () => {
            unsubscribe();
            scroller.removeEventListener('wheel', note);
            scroller.removeEventListener('touchmove', note);
            scroller.removeEventListener('pointerdown', onPointerDown);
            scroller.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [scrollerRef, active]);
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
