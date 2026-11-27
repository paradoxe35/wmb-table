import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import type { McpClientConfigState } from '@shared/mcp.types';

vi.stubGlobal('React', React);

const { ClaudeDesktopSetupView } =
    await import('@renderer/views/options/settings/mcp-claude-desktop-setup');

const CONFIG_PATH = '/home/marie/.config/Claude/claude_desktop_config.json';

function render(state: McpClientConfigState, justConfigured = false): string {
    const configPath = state.state === 'not-installed' ? null : CONFIG_PATH;
    return renderToStaticMarkup(
        <ClaudeDesktopSetupView
            status={{ clientId: 'claude-desktop', configPath, ...state }}
            pending={false}
            justConfigured={justConfigured}
            configure={vi.fn()}
        />,
    );
}

describe('ClaudeDesktopSetupView', () => {
    it('offers the download link and no button when Claude Desktop is not installed', () => {
        const html = render({ state: 'not-installed' });
        expect(html).toContain('Claude Desktop n’est pas installé sur cet ordinateur.');
        expect(html).toContain('href="https://claude.ai/download"');
        expect(html).not.toContain('"mcp-claude-desktop-configure"');
    });

    it('offers « Configurer automatiquement » and names the file when installed', () => {
        const html = render({ state: 'not-configured' });
        expect(html).toContain('Configurer automatiquement');
        expect(html).toContain(CONFIG_PATH);
        expect(html).toContain('copie de sauvegarde');
    });

    it('shows only the check mark when our entry is already right', () => {
        const html = render({ state: 'configured', upToDate: true });
        expect(html).toContain('Déjà configuré');
        expect(html).not.toContain('"mcp-claude-desktop-configure"');
    });

    it('offers « Mettre à jour » when our entry points at another copy', () => {
        const html = render({ state: 'configured', upToDate: false });
        expect(html).toContain('Déjà configuré');
        expect(html).toContain('Mettre à jour');
    });

    it('says to restart Claude Desktop right after writing', () => {
        expect(render({ state: 'configured', upToDate: true }, true)).toContain(
            'Redémarrez Claude Desktop',
        );
    });

    it.each([
        ['malformed', 'n’est pas un JSON valide'],
        ['permission-denied', 'n’a pas le droit'],
        ['write-failed', 'n’a pas pu être lu ou enregistré'],
    ] as const)('explains a %s error and offers no button', (error, text) => {
        const html = render({ state: 'error', error });
        expect(html).toContain(text);
        expect(html).not.toContain('"mcp-claude-desktop-configure"');
    });

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('every text is translated in %s', async (_name, locale) => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(
            'src/renderer/views/options/settings/mcp-claude-desktop-setup.tsx',
            'utf8',
        );
        const keys = [...source.matchAll(/t\(\s*'([^']+)'/g)].map((match) => match[1]);
        expect(keys.length).toBeGreaterThan(8);
        expect(keys.filter((key) => !(key in locale))).toEqual([]);
    });
});
