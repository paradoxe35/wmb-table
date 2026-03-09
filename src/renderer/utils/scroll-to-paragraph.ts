/**
 * Scroll to a paragraph element within a container and trigger a blink animation.
 * Returns true if the element was found and scrolled to.
 */
export function scrollToParagraph(container: HTMLElement | null, paragraphIndex: number): boolean {
    if (!container) return false;
    const el = container.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('paragraph-highlight-blink');
    const cleanup = () => el.classList.remove('paragraph-highlight-blink');
    el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 2500);
    return true;
}
