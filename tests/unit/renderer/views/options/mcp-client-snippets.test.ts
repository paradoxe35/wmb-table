import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import { buildMcpClientSnippets } from '@renderer/views/options/settings/mcp-client-snippets';

const URL = 'http://127.0.0.1:23133/mcp';

function snippet(id: string): string {
    const found = buildMcpClientSnippets(URL).find((s) => s.id === id);
    if (!found) throw new Error(`No snippet ${id}`);
    return found.code;
}

describe('buildMcpClientSnippets', () => {
    it('gives the Claude Code command for an HTTP server, for every project', () => {
        expect(snippet('claude-code')).toBe(
            'claude mcp add --transport http --scope user wmb-table http://127.0.0.1:23133/mcp',
        );
    });

    it('gives the Codex config.toml table with the URL', () => {
        expect(snippet('codex')).toBe(
            '[mcp_servers.wmb-table]\nurl = "http://127.0.0.1:23133/mcp"',
        );
    });

    it('gives Claude Desktop a stdio bridge to the URL', () => {
        expect(JSON.parse(snippet('claude-desktop'))).toEqual({
            mcpServers: {
                'wmb-table': { command: 'npx', args: ['-y', 'mcp-remote', URL] },
            },
        });
    });

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('every hint is translated in %s', (_name, locale) => {
        const missing = buildMcpClientSnippets(URL)
            .map((s) => s.hint)
            .filter((hint) => !locale[hint]);
        expect(missing).toEqual([]);
    });
});
