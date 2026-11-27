/**
 * What the reader did to the document view, so follow reading never fights them:
 * - `scroll` (wheel, keys, drag): following waits inside the paragraph and resumes at the next one;
 * - `jump` (back to start, go to paragraph, search hit, link): following waits until they resume.
 * Either way it resumes once the spoken text is back on screen, or playback starts or skips.
 */
export type FollowPause = 'scroll' | 'jump';

const pauses = new WeakMap<Element, FollowPause>();
const lastScrollAt = new WeakMap<Element, number>();

export function noteUserScroll(scroller: Element, now = performance.now()): void {
    lastScrollAt.set(scroller, now);
    if (pauses.get(scroller) !== 'jump') pauses.set(scroller, 'scroll');
}

export function noteUserJump(scroller: Element): void {
    pauses.set(scroller, 'jump');
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
