import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { McpServerStatus } from '@shared/mcp.types';

vi.stubGlobal('React', React);

const { McpServerSection } = await import('@renderer/views/options/settings/mcp-server-settings');
const { McpConfiguration } = await import('@renderer/views/options/settings/mcp-configuration');

const URL = 'http://127.0.0.1:23132/mcp';
const DEB_LAUNCH = {
    command: '/opt/Wmb Table/wmb-table',
    args: [],
    platform: 'linux',
    dev: false,
} as const;

function render(status: Partial<McpServerStatus> & Pick<McpServerStatus, 'settings'>): string {
    return renderToStaticMarkup(
        <McpServerSection
            status={{ url: null, error: null, launch: DEB_LAUNCH, ...status }}
            pending={false}
            saveFailed={false}
            update={vi.fn()}
        />,
    );
}

const off = { enabled: false, allowWrites: false, port: 23132 };
const on = { enabled: true, allowWrites: false, port: 23132 };

describe('McpServerSection', () => {
    it('shows only the switch and its explanation while the server is off', () => {
        const html = render({ settings: off });
        expect(html).toContain('id="mcp-server-enabled"');
        expect(html).toContain('Claude Desktop, Codex');
        expect(html).not.toContain('mcp-server-allow-writes');
        expect(html).not.toContain('127.0.0.1');
        expect(html).not.toContain('mcp-snippet-');
        expect(html).not.toContain('mcp-configuration');
        expect(html).not.toContain('/opt/Wmb Table');
    });

    it('keeps the write option and errors hidden while off, even when they are set', () => {
        const html = render({
            settings: { ...off, allowWrites: true, port: 23133 },
            error: { code: 'no-free-port', firstPort: 23132, lastPort: 23141 },
        });
        expect(html).not.toContain('mcp-server-allow-writes');
        expect(html).not.toContain('mcp-server-error');
        expect(html).not.toContain('Le port habituel');
    });

    it('shows the write option, the URL and the snippets once enabled', () => {
        const html = render({ settings: on, url: URL });
        expect(html).toContain('id="mcp-server-allow-writes"');
        expect(html).toContain(URL);
        expect(html).toContain('data-testid="mcp-configuration"');
        expect(html).toContain('data-testid="mcp-snippet-claude-desktop-recommended"');
        expect(html).toContain('data-testid="mcp-snippet-claude-desktop-alternative"');
        expect(html).toContain('/opt/Wmb Table/wmb-table');
        expect(html).not.toContain('Le port habituel');
    });

    it('offers one tab per client, the recommended way first, the headless server under Avancé', () => {
        const html = render({ settings: on, url: URL });
        const tabs = ['Claude Desktop', 'Codex', 'Autre application'].map((label) =>
            html.indexOf(`>${label}<`),
        );
        expect(tabs.every((index) => index > -1)).toBe(true);
        expect([...tabs].sort((a, b) => a - b)).toEqual(tabs);
        expect(html.indexOf('mcp-snippet-claude-desktop-recommended')).toBeLessThan(
            html.indexOf('mcp-snippet-claude-desktop-alternative'),
        );
        expect(html).toContain('Wmb Table doit être ouvert.');
        expect(html).toContain('Fonctionne même quand Wmb Table est fermé.');
        expect(html).toContain('>Avancé<');
    });

    it('keeps a place for a per-client action', () => {
        const html = renderToStaticMarkup(
            <McpConfiguration
                status={{ settings: on, url: URL, error: null, launch: DEB_LAUNCH }}
                renderClientAction={(id) => <button data-testid={`auto-${id}`} />}
            />,
        );
        expect(html).toContain('data-testid="auto-claude-desktop"');
    });

    it('labels a development checkout', () => {
        const html = render({
            settings: on,
            url: URL,
            launch: { command: '/usr/bin/electron', args: ['/src'], platform: 'linux', dev: true },
        });
        expect(html).toContain('Commande de développement');
    });

    it('says which port is used when the usual one was busy', () => {
        const html = render({
            settings: { ...on, port: 23133 },
            url: 'http://127.0.0.1:23133/mcp',
        });
        expect(html).toContain('Le port habituel');
    });

    it('shows a start error instead of the URL', () => {
        const html = render({
            settings: on,
            error: { code: 'no-free-port', firstPort: 23132, lastPort: 23141 },
        });
        expect(html).toContain('data-testid="mcp-server-error"');
        expect(html).not.toContain('data-testid="mcp-server-url"');
        expect(html).toContain('data-testid="mcp-snippet-claude-desktop-recommended"');
    });
});
