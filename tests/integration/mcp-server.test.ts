import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createTestDb } from '../unit/main/database/test-helpers';
import { createBibleFixture, removeBibleFixture } from '../helpers/bible-fixture';
import { freeLoopbackPort } from '../helpers/free-port';

vi.mock('@main/ipc/ipc-bridge', () => ({ sendToRenderer: vi.fn() }));

vi.mock('@main/services/tantivy.service', () => ({ getInstalledLanguages: () => ['fr', 'en'] }));

vi.mock('@main/services/bible.service', async () => {
    const { fakeBibleService } = await import('../helpers/bible-fixture');
    return {
        ...fakeBibleService,
        getResolvedBibleVersionForLanguage: (langCode: string) =>
            fakeBibleService.getBibleVersionsForLanguage(langCode)[0] ?? null,
    };
});

vi.mock('@main/database/repositories/config.repository', () => ({
    getContentLanguage: () => 'fr',
    getActiveBibleVersionAbbreviation: () => 'lsg',
}));

const { startMcpHttpServer } = await import('@main/services/mcp/mcp-http-server');
const { createLibraryMcpServer } = await import('@main/services/mcp/library-mcp-server');
const { buildToolExecutors } = await import('@main/services/ai/tools');
const { WRITE_TOOL_NAMES } = await import('@main/services/ai/tools/tool-access');
const notesRepo = await import('@main/database/repositories/notes.repository');

type Started = Awaited<ReturnType<typeof startMcpHttpServer>>;

let server: Started | null = null;
let client: Client | null = null;

async function connect(allowWrites: boolean): Promise<Client> {
    server = await startMcpHttpServer({
        firstPort: await freeLoopbackPort(),
        createServer: () => createLibraryMcpServer({ allowWrites, version: '0.0.0-test' }),
    });
    client = new Client({ name: 'wmb-table-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
    return client;
}

function textOf(result: { content?: unknown }): string {
    const [first] = (result.content ?? []) as { type: string; text?: string }[];
    return first?.text ?? '';
}

beforeAll(createBibleFixture);
afterAll(removeBibleFixture);
beforeEach(() => {
    createTestDb();
});
afterEach(async () => {
    await client?.close();
    await server?.close();
    client = null;
    server = null;
});

describe('MCP server over Streamable HTTP', () => {
    it('lists the read tools with the assistant descriptions in read-only mode', async () => {
        const mcp = await connect(false);
        const { tools } = await mcp.listTools();
        const executors = buildToolExecutors('fr', 'lsg');
        const readNames = Object.keys(executors).filter((name) => !WRITE_TOOL_NAMES.has(name));

        expect(tools.map((tool) => tool.name).sort()).toEqual(readNames.sort());
        const search = tools.find((tool) => tool.name === 'searchSermons');
        expect(search?.description).toBe(executors.searchSermons.description);
        expect(search?.annotations?.readOnlyHint).toBe(true);
        expect(search?.inputSchema.properties).toHaveProperty('query');
    });

    it('reads a Bible passage from the fixture in the app content language', async () => {
        const mcp = await connect(false);
        const result = await mcp.callTool({
            name: 'getBiblePassage',
            arguments: { bookCode: '43N', chapter: '3', fromVerse: '16' },
        });

        expect(result.isError).toBeFalsy();
        const passage = JSON.parse(textOf(result));
        expect(passage.bibleVersionAbbreviation).toBe('lsg');
        expect(passage.verses[0].content).toContain('Dieu a tant aimé le monde');
    });

    it('returns tool failures as MCP tool errors', async () => {
        const mcp = await connect(false);
        const result = await mcp.callTool({
            name: 'getBiblePassage',
            arguments: { bookCode: '43N', chapter: '3', languageCode: 'es' },
        });

        expect(result.isError).toBe(true);
        expect(JSON.parse(textOf(result)).error).toContain('"es"');
    });

    it('refuses a write tool in read-only mode and leaves the notes untouched', async () => {
        const mcp = await connect(false);
        const result = await mcp
            .callTool({ name: 'createNote', arguments: { name: "L'amour", content: 'x' } })
            .catch((error: Error) => ({
                isError: true,
                content: [{ type: 'text', text: error.message }],
            }));

        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain('createNote');
        expect(notesRepo.getAllSummary()).toEqual([]);
    });

    it('exposes and runs the write tools when changes are allowed', async () => {
        const mcp = await connect(true);
        const { tools } = await mcp.listTools();
        expect(tools.map((tool) => tool.name)).toEqual(
            expect.arrayContaining([...WRITE_TOOL_NAMES]),
        );
        expect(tools.find((tool) => tool.name === 'createNote')?.annotations?.readOnlyHint).toBe(
            false,
        );

        const result = await mcp.callTool({
            name: 'createNote',
            arguments: { name: "L'amour du Saint-Esprit", content: 'Romains 5:5' },
        });

        expect(result.isError).toBeFalsy();
        expect(notesRepo.getAllSummary().map((note) => note.name)).toEqual([
            "L'amour du Saint-Esprit",
        ]);
    });

    it('validates tool input with the tool schema', async () => {
        const mcp = await connect(true);
        const result = await mcp.callTool({ name: 'createNote', arguments: { name: 'x' } });

        expect(result.isError).toBe(true);
        expect(notesRepo.getAllSummary()).toEqual([]);
    });
});
