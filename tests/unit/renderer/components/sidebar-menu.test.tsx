import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';

const appState = { mainView: 'options', optionView: 'history', showOptions: vi.fn() };

vi.mock('@renderer/stores', () => ({
    useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
}));

vi.mock('@renderer/components/audio-document-player-indicator', () => ({
    default: () => null,
}));

const { default: SidebarMenu } = await import('@renderer/components/layout/sidebar-menu');

function renderWithStoredSettings(settings: AiSettings): string {
    vi.stubGlobal('window', {
        api: {
            ai: { getSettings: vi.fn().mockResolvedValue(settings) },
            on: { switchOnOptions: vi.fn(() => () => undefined) },
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    });
    return renderToStaticMarkup(<SidebarMenu collapsed={false} />);
}

describe('SidebarMenu', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the assistant with the default settings', () => {
        const html = renderWithStoredSettings(createDefaultAiSettings());
        expect(html).toMatch(/data-menu-id="[^"]*ai-chat"/);
        expect(html).toContain('Assistant');
    });

    it('shows the assistant for an old profile that turned it off', () => {
        const html = renderWithStoredSettings({ ...createDefaultAiSettings(), enabled: false });
        expect(html).toMatch(/data-menu-id="[^"]*ai-chat"/);
    });
});
