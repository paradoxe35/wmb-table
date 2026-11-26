// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DebouncedInput from '@renderer/components/debounced-input';

const DELAY_MS = 600;

function field(): HTMLInputElement {
    return screen.getByRole('textbox');
}

function type(value: string): void {
    fireEvent.change(field(), { target: { value } });
}

describe('DebouncedInput', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('saves a value typed right before the field unmounts', () => {
        const onChange = vi.fn();
        const { unmount } = render(<DebouncedInput value="" onChange={onChange} />);

        type('sk-new-key');
        act(() => vi.advanceTimersByTime(DELAY_MS / 2));
        unmount();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('sk-new-key');
    });

    it('saves through the latest callback when the parent re-renders mid-typing', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = render(<DebouncedInput value="" onChange={first} />);

        type('l’amour');
        rerender(<DebouncedInput value="" onChange={second} />);
        act(() => vi.advanceTimersByTime(DELAY_MS));

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith('l’amour');
        expect(field().value).toBe('l’amour');
    });

    it('keeps the typed text when an older saved value arrives while a save is pending', () => {
        const onChange = vi.fn();
        const { rerender } = render(<DebouncedInput value="old" onChange={onChange} />);

        type('Saint-Esprit');
        rerender(<DebouncedInput value="older" onChange={onChange} />);

        expect(field().value).toBe('Saint-Esprit');
    });

    it.each(['beforeunload', 'pagehide'])(
        'saves a value typed right before the page fires %s',
        (eventName) => {
            const onChange = vi.fn();
            render(<DebouncedInput value="" onChange={onChange} />);

            type('sk-typed-before-reload');
            act(() => vi.advanceTimersByTime(DELAY_MS / 3));
            window.dispatchEvent(new Event(eventName));

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('sk-typed-before-reload');
            act(() => vi.advanceTimersByTime(DELAY_MS * 2));
            expect(onChange).toHaveBeenCalledTimes(1);
        },
    );

    it('does not save again on unload when nothing is pending', () => {
        const onChange = vi.fn();
        render(<DebouncedInput value="" onChange={onChange} />);

        type('saved');
        act(() => vi.advanceTimersByTime(DELAY_MS));
        window.dispatchEvent(new Event('beforeunload'));
        window.dispatchEvent(new Event('pagehide'));

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('stops listening for unload once unmounted', () => {
        const onChange = vi.fn();
        const { unmount } = render(<DebouncedInput value="" onChange={onChange} />);
        unmount();

        window.dispatchEvent(new Event('beforeunload'));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('saves at once on blur', () => {
        const onChange = vi.fn();
        render(<DebouncedInput value="" onChange={onChange} />);

        type('http://localhost:11434');
        fireEvent.blur(field());

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('http://localhost:11434');
        act(() => vi.advanceTimersByTime(DELAY_MS * 2));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('saves rapid typing once, with the last value', () => {
        const onChange = vi.fn();
        render(<DebouncedInput value="" onChange={onChange} />);

        for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
            type(value);
            act(() => vi.advanceTimersByTime(60));
        }
        act(() => vi.advanceTimersByTime(DELAY_MS));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('abcde');
    });

    it('does not save a value the validator refuses', () => {
        const onChange = vi.fn();
        render(
            <DebouncedInput
                value=""
                onChange={onChange}
                validate={(value) => (value.startsWith('http') ? undefined : 'invalid')}
            />,
        );

        type('localhost:1234');
        act(() => vi.advanceTimersByTime(DELAY_MS));
        fireEvent.blur(field());

        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText('invalid')).toBeTruthy();
    });
});
