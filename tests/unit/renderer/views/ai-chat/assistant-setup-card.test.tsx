import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ButtonProps } from 'antd';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import { buildDocsGuideLink } from '@shared/constants';

vi.stubGlobal('React', React);

const buttons: ButtonProps[] = [];
const appState = { openSettingsTab: vi.fn(), contentLanguage: 'fr' };

vi.mock('antd', async (importOriginal) => ({
    ...(await importOriginal<typeof import('antd')>()),
    Button: (props: ButtonProps) => {
        buttons.push(props);
        return <button type="button">{props.children}</button>;
    },
}));

vi.mock('@renderer/stores', () => ({
    useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
}));

const { default: AssistantSetupCard } =
    await import('@renderer/views/options/ai-chat/assistant-setup-card');

const openExternal = vi.fn();

function renderCard(): string {
    buttons.length = 0;
    return renderToStaticMarkup(<AssistantSetupCard />);
}

function buttonLabelled(label: string): ButtonProps {
    const button = buttons.find((b) => b.children === label);
    if (!button) throw new Error(`No button "${label}"`);
    return button;
}

const cardSource = readFileSync(
    resolve(
        __dirname,
        '../../../../../src/renderer/views/options/ai-chat/assistant-setup-card.tsx',
    ),
    'utf8',
);
const cardKeys = [...cardSource.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)+)\1/g)].map((m) => m[2]);

describe('AssistantSetupCard', () => {
    beforeEach(() => {
        appState.openSettingsTab.mockClear();
        openExternal.mockClear();
        vi.stubGlobal('window', { api: { app: { openExternal } } });
    });

    it('presents the assistant as a study companion, not a search tool', () => {
        const html = renderCard();
        expect(html).toContain('Assistant IA');
        expect(html).toContain('rapproche ce que disent les prédications et les Écritures');
        expect(html).toContain('Ollama sur votre ordinateur');
        expect(html.toLowerCase()).not.toContain('recherch');
    });

    it('opens Settings on the Assistant tab', () => {
        renderCard();
        buttonLabelled("Configurer l'assistant").onClick?.({} as never);
        expect(appState.openSettingsTab).toHaveBeenCalledWith('ai');
    });

    it('opens the assistant guide in the content language', () => {
        renderCard();
        buttonLabelled('Voir le guide').onClick?.({} as never);
        expect(openExternal).toHaveBeenCalledWith(buildDocsGuideLink('settings-assistant', 'fr'));
    });

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('is translated in %s', (_name, locale) => {
        expect(cardKeys.length).toBeGreaterThanOrEqual(5);
        expect(cardKeys.filter((key) => !locale[key])).toEqual([]);
    });
});
