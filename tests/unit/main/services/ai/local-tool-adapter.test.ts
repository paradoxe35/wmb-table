import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@ai-sdk/provider-utils', () => ({
    generateId: vi.fn(() => 'tool-call-1'),
}));

const { buildLocalChatFunctions } = await import('@main/services/ai/local/local-tool-adapter');

describe('local-tool-adapter', () => {
    it('validates tool input before execution in local mode', async () => {
        const executeMock = vi.fn();
        const onToolCall = vi.fn();
        const onToolResult = vi.fn();

        const functions = buildLocalChatFunctions({
            executors: {
                saveThing: {
                    description: 'Save a thing',
                    inputSchema: z.object({ count: z.number().int().min(1) }),
                    execute: executeMock,
                },
            },
            onToolCall,
            onToolResult,
        });

        const result = await functions.saveThing.handler({ count: 'bad' } as Record<
            string,
            unknown
        >);

        expect(executeMock).not.toHaveBeenCalled();
        expect(onToolCall).toHaveBeenCalledWith({
            id: 'tool-call-1',
            name: 'saveThing',
            input: { count: 'bad' },
        });
        expect(onToolResult).toHaveBeenCalledWith({
            toolCallId: 'tool-call-1',
            name: 'saveThing',
            output: expect.objectContaining({
                error: expect.stringContaining('Invalid input for tool "saveThing"'),
            }),
            isError: true,
        });
        expect(result).toEqual(
            expect.objectContaining({
                error: expect.stringContaining('Invalid input for tool "saveThing"'),
            }),
        );
    });

    it('passes validated input to the executor', async () => {
        const executeMock = vi.fn(async (input) => ({ ok: true, input }));

        const functions = buildLocalChatFunctions({
            executors: {
                saveThing: {
                    description: 'Save a thing',
                    inputSchema: z.object({ count: z.number().int().min(1) }),
                    execute: executeMock,
                },
            },
        });

        const result = await functions.saveThing.handler({ count: 2 });

        expect(executeMock).toHaveBeenCalledWith({ count: 2 });
        expect(result).toEqual({ ok: true, input: { count: 2 } });
    });
});
