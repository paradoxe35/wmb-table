/**
 * What the reader did to the document view, so follow reading never fights them:
 * - `scroll` (wheel, keys, drag): following waits inside the paragraph and resumes at the next one;
 * - `jump` (back to start, go to paragraph, search hit, link): following waits until they resume.
 * Either way it resumes once the spoken text is back on screen, or playback starts or skips.
 */
export type FollowPause = 'scroll' | 'jump';

const pauses = new WeakMap<Element, FollowPause>();
const lastScrollAt = new WeakMap<Element, number>();
/** Ends the move of a jump still under way (a smooth glide passes over the spoken text). */
const moving = new WeakMap<Element, () => void>();

/** In case the browser sends no `scrollend`, e.g. when the view was already in place. */
const JUMP_MOVE_FALLBACK_MS = 3_000;

export function noteUserScroll(scroller: Element, now = performance.now()): void {
    lastScrollAt.set(scroller, now);
    if (pauses.get(scroller) !== 'jump') pauses.set(scroller, 'scroll');
}

export function noteUserJump(scroller: Element): void {
    pauses.set(scroller, 'jump');
    moving.get(scroller)?.();
    const settled = () => {
        clearTimeout(fallback);
        scroller.removeEventListener('scrollend', settled);
        if (moving.get(scroller) === settled) moving.delete(scroller);
    };
    const fallback = setTimeout(settled, JUMP_MOVE_FALLBACK_MS);
    scroller.addEventListener('scrollend', settled);
    moving.set(scroller, settled);
}

/** The view is still on its way to where the reader jumped. */
export function isJumpMoving(scroller: Element): boolean {
    return moving.has(scroller);
}

export function resumeFollowing(scroller: Element): void {
    pauses.delete(scroller);
}

export function followPause(scroller: Element): FollowPause | null {
    return pauses.get(scroller) ?? null;
}

export function msSinceUserScroll(scroller: Element, now = performance.now()): number {
    const at = lastScrollAt.get(scroller);
    return at == null ? Infinity : now - at;
}
