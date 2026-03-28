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
    el.classList.add('paragraph-highlight-blink');
    const cleanup = () => el.classList.remove('paragraph-highlight-blink');
    el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 2500);
    return true;
}
