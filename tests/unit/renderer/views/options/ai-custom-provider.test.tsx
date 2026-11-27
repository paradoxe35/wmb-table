// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@renderer/i18n';
import AiCustomProviderModal from '@renderer/views/options/settings/ai-custom-provider';

function renderModal(onAdd = vi.fn()) {
    render(
        <AiCustomProviderModal
            open
            onClose={vi.fn()}
            onAdd={onAdd}
            takenIds={[]}
            takenNames={[]}
        />,
    );
    return onAdd;
}

function fill(id: string, value: string): void {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
}

describe('AiCustomProviderModal', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        await i18n.changeLanguage('fr');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('puts the cursor in the name field when it opens', () => {
        renderModal();
        act(() => vi.advanceTimersByTime(100));

        expect(document.activeElement?.id).toBe('ai-custom-provider-name');
    });

    it('adds the provider when Enter is pressed in a field once it is complete', () => {
        const onAdd = renderModal();
        fill('ai-custom-provider-name', 'Mon serveur');
        fill('ai-custom-provider-base-url', 'http://127.0.0.1:1234/v1');
        fill('ai-custom-provider-model', 'llama3');

        fireEvent.keyDown(document.getElementById('ai-custom-provider-model') as HTMLElement, {
            key: 'Enter',
            keyCode: 13,
        });

        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0]).toMatchObject({
            name: 'Mon serveur',
            defaultModel: 'llama3',
        });
    });

    it('does nothing on Enter while a required field is missing', () => {
        const onAdd = renderModal();
        fill('ai-custom-provider-name', 'Mon serveur');

        fireEvent.keyDown(document.getElementById('ai-custom-provider-name') as HTMLElement, {
            key: 'Enter',
            keyCode: 13,
        });

        expect(onAdd).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Ajouter' })).toHaveProperty('disabled', true);
    });
});
