// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelSelect } from '@renderer/views/options/settings/ai-model-select';

const DELAY_MS = 500;

function field(): HTMLInputElement {
    return screen.getByRole('combobox');
}

function type(value: string): void {
    fireEvent.change(field(), { target: { value } });
}

function renderSelect(value: string, onChange: (model: string) => void) {
    return <ModelSelect providerId="mock" value={value} onChange={onChange} id="model" />;
}

describe('ModelSelect', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('api', {
            ai: {
                fetchProviderModels: vi.fn(async () => []),
                getModelLimits: vi.fn(async () => null),
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('does not go back to an older saved model while the user is typing', () => {
        const onChange = vi.fn();
        const { rerender } = render(renderSelect('', onChange));
        fireEvent.focus(field());

        type('llama3');
        act(() => vi.advanceTimersByTime(DELAY_MS + 100));
        type('llama3.1');
        act(() => vi.advanceTimersByTime(DELAY_MS + 100));
        rerender(renderSelect('llama3', onChange));

        expect(field().value).toBe('llama3.1');
        expect(onChange.mock.calls).toEqual([['llama3'], ['llama3.1']]);
    });

    it('shows a saved model at once when the field is not focused', () => {
        const { rerender } = render(renderSelect('old-model', vi.fn()));

        rerender(renderSelect('new-model', vi.fn()));

        expect(field().value).toBe('new-model');
    });
});
