// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    followPause,
    isJumpMoving,
    noteUserJump,
    resumeFollowing,
} from '@renderer/utils/user-scroll';

let scroller: HTMLElement;

beforeEach(() => {
    vi.useFakeTimers();
    scroller = document.createElement('div');
});

afterEach(() => {
    vi.useRealTimers();
});

describe('a jump on its way', () => {
    it('is moving until the browser says the scroll ended', () => {
        noteUserJump(scroller);
        expect(isJumpMoving(scroller)).toBe(true);
        scroller.dispatchEvent(new Event('scrollend'));
        expect(isJumpMoving(scroller)).toBe(false);
        expect(followPause(scroller)).toBe('jump');
    });

    it('stops counting as moving after a while when no scrollend comes', () => {
        noteUserJump(scroller);
        vi.advanceTimersByTime(2_900);
        expect(isJumpMoving(scroller)).toBe(true);
        vi.advanceTimersByTime(200);
        expect(isJumpMoving(scroller)).toBe(false);
    });

    it('a new jump starts its own move, and the old timer does not end it early', () => {
        noteUserJump(scroller);
        vi.advanceTimersByTime(2_000);
        noteUserJump(scroller);
        vi.advanceTimersByTime(1_500);
        expect(isJumpMoving(scroller)).toBe(true);
        scroller.dispatchEvent(new Event('scrollend'));
        expect(isJumpMoving(scroller)).toBe(false);
    });

    it('resuming follow reading clears the pause', () => {
        noteUserJump(scroller);
        resumeFollowing(scroller);
        expect(followPause(scroller)).toBeNull();
    });
});
