import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { McpServerStatus } from '@shared/mcp.types';

vi.stubGlobal('React', React);

const { McpServerSection } = await import('@renderer/views/options/settings/mcp-server-settings');

const URL = 'http://127.0.0.1:23132/mcp';

function render(status: Partial<McpServerStatus> & Pick<McpServerStatus, 'settings'>): string {
    return renderToStaticMarkup(
        <McpServerSection
            status={{ url: null, error: null, ...status }}
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
        expect(html).toContain('Claude Desktop, Claude Code, Codex');
        expect(html).not.toContain('mcp-server-allow-writes');
        expect(html).not.toContain('127.0.0.1');
        expect(html).not.toContain('mcp-snippet-');
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
        expect(html).toContain('data-testid="mcp-snippet-claude-code"');
        expect(html).not.toContain('Le port habituel');
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
        expect(html).not.toContain('mcp-snippet-');
    });
});
