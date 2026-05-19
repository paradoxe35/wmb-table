const BLINK_CLASS = 'paragraph-highlight-blink';
const BLINK_FALLBACK_MS = 2500;

let activeBlinkCleanup: (() => void) | null = null;

/**
 * Scroll to a paragraph element within a container and trigger a blink animation.
 * Returns true if the element was found and scrolled to.
 */
export function scrollToParagraph(container: HTMLElement | null, paragraphIndex: number): boolean {
    if (!container) return false;
    const el = container.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
    if (!el) return false;

    const containerRect = container.getBoundingClientRect();
    const paragraphRect = el.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;
    const rawTargetTop =
        currentScrollTop +
        (paragraphRect.top - containerRect.top) -
        container.clientHeight / 2 +
        paragraphRect.height / 2;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const targetTop = Math.min(Math.max(rawTargetTop, 0), maxScrollTop);

    container.scrollTop = targetTop;

    // Cancel any previous blink so two paragraphs never glow at once.
    activeBlinkCleanup?.();

    // Restart the animation even if the class is already present (same paragraph re-navigated).
    el.classList.remove(BLINK_CLASS);
    void el.offsetWidth;
    el.classList.add(BLINK_CLASS);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
        el.classList.remove(BLINK_CLASS);
        el.removeEventListener('animationend', cleanup);
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (activeBlinkCleanup === cleanup) {
            activeBlinkCleanup = null;
        }
    };

    el.addEventListener('animationend', cleanup);
    timeoutId = setTimeout(cleanup, BLINK_FALLBACK_MS);
    activeBlinkCleanup = cleanup;

    return true;
}
