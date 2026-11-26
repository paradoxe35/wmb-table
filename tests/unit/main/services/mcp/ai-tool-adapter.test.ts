import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { AiToolDefinition } from '@main/services/ai/tools/types';
import { WRITE_TOOL_NAMES } from '@main/services/ai/tools/tool-access';
import { registerAiTools, runAiTool, selectExposedTools } from '@main/services/mcp/ai-tool-adapter';

vi.mock('@main/ipc/ipc-bridge', () => ({ sendToRenderer: vi.fn() }));

const { buildToolExecutors } = await import('@main/services/ai/tools');

interface Registered {
    name: string;
    config: { description?: string; inputSchema?: unknown; annotations?: Record<string, unknown> };
    callback: (input: unknown) => Promise<unknown>;
}

function recordingServer(): { server: McpServer; registered: Registered[] } {
    const registered: Registered[] = [];
    const server = {
        registerTool: (
            name: string,
            config: Registered['config'],
            callback: Registered['callback'],
        ) => registered.push({ name, config, callback }),
    } as unknown as McpServer;
    return { server, registered };
}

const definition = (execute: AiToolDefinition['execute']): AiToolDefinition => ({
    description: 'A tool',
    inputSchema: z.object({ q: z.string() }),
    execute,
});

describe('selectExposedTools', () => {
    const executors = buildToolExecutors('fr', 'lsg');

    it('hides every write tool when changes are not allowed', () => {
        const names = Object.keys(selectExposedTools(executors, false));
        expect(names.filter((name) => WRITE_TOOL_NAMES.has(name))).toEqual([]);
        expect(names).toContain('searchSermons');
        expect(names).toContain('getNoteById');
    });

    it('keeps every tool when changes are allowed', () => {
        expect(Object.keys(selectExposedTools(executors, true))).toEqual(Object.keys(executors));
    });

    it('never exposes the sub-agent tools, which need a model', () => {
        const names = Object.keys(selectExposedTools(executors, true));
        expect(names).not.toContain('researchTopic');
        expect(names.some((name) => /reader|agent/i.test(name))).toBe(false);
    });
});

describe('registerAiTools', () => {
    it('keeps the name, description and schema of every exposed tool', () => {
        const executors = buildToolExecutors('fr', 'lsg');
        const { server, registered } = recordingServer();
        registerAiTools(server, executors);

        expect(registered.map((tool) => tool.name)).toEqual(Object.keys(executors));
        for (const tool of registered) {
            expect(tool.config.description).toBe(executors[tool.name].description);
            expect(tool.config.inputSchema).toBe(executors[tool.name].inputSchema);
        }
    });

    it('marks read tools read-only and write tools not', () => {
        const { server, registered } = recordingServer();
        registerAiTools(server, buildToolExecutors('fr', 'lsg'));
        for (const tool of registered) {
            expect(tool.config.annotations).toEqual({
                readOnlyHint: !WRITE_TOOL_NAMES.has(tool.name),
                openWorldHint: false,
            });
        }
    });

    it('runs the tool with the input the client sent', async () => {
        const execute = vi.fn(async ({ q }: { q: string }) => ({ echoed: q }));
        const { server, registered } = recordingServer();
        registerAiTools(server, { echo: definition(execute) });

        const result = await registered[0].callback({ q: "l'amour" });
        expect(execute).toHaveBeenCalledWith({ q: "l'amour" });
        expect(result).toEqual({ content: [{ type: 'text', text: '{"echoed":"l\'amour"}' }] });
    });
});

describe('runAiTool', () => {
    it('returns the tool result as JSON text', async () => {
        const result = await runAiTool(
            't',
            definition(async () => [{ id: 1 }]),
            {},
        );
        expect(result).toEqual({ content: [{ type: 'text', text: '[{"id":1}]' }] });
    });

    it('returns an empty result as null text', async () => {
        const result = await runAiTool(
            't',
            definition(async () => undefined),
            {},
        );
        expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
        expect(result.isError).toBeUndefined();
    });

    it('turns an { error } result into an MCP tool error', async () => {
        const result = await runAiTool(
            't',
            definition(async () => ({ error: 'Language "xx" is not installed.' })),
            {},
        );
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
            { type: 'text', text: '{"error":"Language \\"xx\\" is not installed."}' },
        ]);
    });

    it('turns a thrown error into an MCP tool error with its message', async () => {
        const result = await runAiTool(
            't',
            definition(async () => {
                throw new Error('database is closed');
            }),
            {},
        );
        expect(result).toEqual({
            content: [{ type: 'text', text: 'database is closed' }],
            isError: true,
        });
    });

    it('does not treat an empty error field as a failure', async () => {
        const result = await runAiTool(
            't',
            definition(async () => ({ error: '' })),
            {},
        );
        expect(result.isError).toBeUndefined();
    });
});
