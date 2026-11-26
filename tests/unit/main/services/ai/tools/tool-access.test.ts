import { describe, expect, it, vi } from 'vitest';
import { WRITE_TOOL_NAMES, isWriteTool } from '@main/services/ai/tools/tool-access';

vi.mock('@main/ipc/ipc-bridge', () => ({ sendToRenderer: vi.fn() }));

const { buildToolExecutors } = await import('@main/services/ai/tools');

describe('WRITE_TOOL_NAMES', () => {
    const toolNames = Object.keys(buildToolExecutors('fr', 'lsg'));

    it('only names tools that exist', () => {
        expect(toolNames).toEqual(expect.arrayContaining([...WRITE_TOOL_NAMES]));
    });

    it('covers every tool that creates, changes or removes something', () => {
        const writeLike = toolNames.filter((name) =>
            /^(create|edit|append|update|add|remove|delete|rename|set)/.test(name),
        );
        expect(writeLike.sort()).toEqual([...WRITE_TOOL_NAMES].sort());
    });

    it('classifies the read tools as reads', () => {
        for (const name of ['searchSermons', 'getSermonContent', 'getNotes', 'getSubjectById']) {
            expect(isWriteTool(name)).toBe(false);
        }
    });
});
