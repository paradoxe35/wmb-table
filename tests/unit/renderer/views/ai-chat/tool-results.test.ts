import { describe, expect, it } from 'vitest';
import type { AiToolResult } from '@shared/ai.types';
import { groupToolResults } from '@renderer/views/options/ai-chat/tool-results';

function result(name: string, isError?: boolean): AiToolResult {
    return { toolCallId: `${name}-${isError ? 'ko' : 'ok'}`, name, output: {}, isError };
}

describe('groupToolResults', () => {
    it('counts repeated calls to the same tool', () => {
        expect(groupToolResults([result('searchContent'), result('searchContent')])).toEqual([
            { name: 'searchContent', count: 2, incomplete: false },
        ]);
    });

    it('hides failed calls so the strip never announces work that did not happen', () => {
        expect(groupToolResults([result('editNote', true)])).toEqual([]);
    });

    it('keeps the successful calls of a tool that also failed once', () => {
        expect(
            groupToolResults([result('editNote'), result('editNote', true), result('getNotes')]),
        ).toEqual([
            { name: 'editNote', count: 1, incomplete: false },
            { name: 'getNotes', count: 1, incomplete: false },
        ]);
    });

    it('marks research a sub-agent could not finish', () => {
        const incomplete: AiToolResult = {
            toolCallId: 'r1',
            name: 'researchTopic',
            output: { status: 'incomplete', reason: 'step-limit', response: '…' },
        };

        expect(groupToolResults([result('researchTopic'), incomplete])).toEqual([
            { name: 'researchTopic', count: 2, incomplete: true },
        ]);
    });
});
