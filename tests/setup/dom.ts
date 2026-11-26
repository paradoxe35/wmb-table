/** jsdom lacks the layout APIs Ant Design reads; node tests have no window and skip this. */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    class ResizeObserverStub {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }

    globalThis.ResizeObserver ??= ResizeObserverStub;
    window.matchMedia ??= (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
}
