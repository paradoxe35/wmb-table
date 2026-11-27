// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@renderer/i18n';
import DocumentTopButton, {
    shouldShowTopButton,
} from '@renderer/views/document-view/document-top-button';
import { followPause, noteUserScroll } from '@renderer/utils/user-scroll';

const screenHeight = 400;
const documentHeight = 4000;

describe('shouldShowTopButton', () => {
    const at = (scrollTop: number, goingUp = false) =>
        shouldShowTopButton({
            scrollTop,
            clientHeight: screenHeight,
            scrollHeight: documentHeight,
            goingUp,
        });

    it('stays hidden near the start, even when going up', () => {
        expect(at(0)).toBe(false);
        expect(at(screenHeight, true)).toBe(false);
    });

    it('stays hidden while reading down the middle', () => {
        expect(at(1500)).toBe(false);
    });

    it('shows when the reader heads back up far from the start', () => {
        expect(at(1500, true)).toBe(true);
    });

    it('shows near the end of the document', () => {
        expect(at(documentHeight - screenHeight - 200)).toBe(true);
        expect(at(documentHeight - screenHeight)).toBe(true);
    });

    it('never shows for a document barely longer than the screen', () => {
        expect(
            shouldShowTopButton({
                scrollTop: 300,
                clientHeight: screenHeight,
                scrollHeight: 700,
                goingUp: false,
            }),
        ).toBe(false);
    });

    it('stays hidden while the panel has no size', () => {
        expect(
            shouldShowTopButton({ scrollTop: 0, clientHeight: 0, scrollHeight: 0, goingUp: true }),
        ).toBe(false);
    });
});

function Harness({ active = true }: { active?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <>
            <div ref={ref} data-testid="scroller" />
            <DocumentTopButton scrollerRef={ref} active={active} />
        </>
    );
}

let scrollTo: ReturnType<typeof vi.fn>;
let reducedMotion = false;

function setUp(active = true) {
    render(<Harness active={active} />);
    const scroller = screen.getByTestId('scroller');
    let top = 0;
    Object.defineProperty(scroller, 'clientHeight', { value: screenHeight });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: documentHeight });
    Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => top,
        set: (value: number) => {
            top = value;
        },
    });
    scroller.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
    /** `own`: the reader scrolled (wheel, keys); otherwise the app moved the view. */
    const scrollToPosition = async (value: number, own = true) => {
        if (own) noteUserScroll(scroller);
        top = value;
        await act(async () => {
            fireEvent.scroll(scroller);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    };
    const wrapper = () => document.querySelector('.document-top-button')!;
    const button = () => screen.getByRole('button', { hidden: true });
    return { scroller, scrollToPosition, wrapper, button };
}

beforeEach(() => {
    scrollTo = vi.fn();
    reducedMotion = false;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({ matches: reducedMotion && query.includes('reduce') }) as MediaQueryList,
    );
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('DocumentTopButton', () => {
    it('is hidden and out of the Tab order at the start', () => {
        const { wrapper, button } = setUp();
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
        expect(button().getAttribute('tabindex')).toBe('-1');
    });

    it('appears near the end and hides again while reading down the middle', async () => {
        const { scrollToPosition, wrapper, button } = setUp();
        await scrollToPosition(3500);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(true);
        expect(button().getAttribute('tabindex')).toBe('0');
        expect(button().getAttribute('aria-label')).toBe('Revenir au début');

        await scrollToPosition(1000);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(true);
        await scrollToPosition(1100);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
    });

    it('ignores a small nudge of the wheel', async () => {
        const { scrollToPosition, wrapper } = setUp();
        await scrollToPosition(1500);
        await scrollToPosition(1480);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
        await scrollToPosition(1450);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(true);
    });

    it('does not appear when the app moves the view up (zoom, navigation, follow reading)', async () => {
        const { scrollToPosition, wrapper } = setUp();
        await scrollToPosition(2000, false);
        await scrollToPosition(1500, false);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
    });

    it('checks again when the window is resized', async () => {
        const { scroller, scrollToPosition, wrapper } = setUp();
        await scrollToPosition(2000, false);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
        Object.defineProperty(scroller, 'scrollHeight', { value: 2600 });
        await act(async () => {
            window.dispatchEvent(new Event('resize'));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(true);
    });

    it('moves keyboard focus to the start of the document', async () => {
        const { scroller, scrollToPosition, button } = setUp();
        const start = document.createElement('div');
        start.setAttribute('data-document-start', '');
        scroller.append(start);
        await scrollToPosition(3500);
        fireEvent.click(button(), { detail: 0 });
        expect(document.activeElement).toBe(start);
    });

    it('glides back to the start, and follow reading lets the reader stay there', async () => {
        const { scroller, scrollToPosition, button } = setUp();
        await scrollToPosition(3500);
        fireEvent.click(button());
        expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'smooth' });
        expect(followPause(scroller)).toBe('jump');
    });

    it('jumps without animation when the system asks for reduced motion', async () => {
        reducedMotion = true;
        const { scrollToPosition, button } = setUp();
        await scrollToPosition(3500);
        fireEvent.click(button());
        expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
    });

    it('stays hidden while the document is not ready', async () => {
        const { scrollToPosition, wrapper } = setUp(false);
        await scrollToPosition(3500);
        expect(wrapper().classList.contains('document-top-button--visible')).toBe(false);
    });
});
