import type { AiToolResult } from '@shared/ai.types';

export interface GroupedToolResult {
    name: string;
    count: number;
    /** A sub-agent stopped before it finished its research (step, time or context limit). */
    incomplete: boolean;
}

function isIncompleteSubAgentResult(output: unknown): boolean {
    return (
        typeof output === 'object' &&
        output !== null &&
        (output as { status?: unknown }).status === 'incomplete'
    );
}

/**
 * Group the activity strip entries for a running answer.
 *
 * Failed calls stay in history for the assistant but are never shown: the strip speaks in
 * plain language to non-technical users, and announcing "note updated" for a call that
 * failed would tell them something untrue.
 */
export function groupToolResults(results: AiToolResult[]): GroupedToolResult[] {
    const groups = new Map<string, GroupedToolResult>();

    for (const result of results) {
        if (result.isError) continue;
        const group = groups.get(result.name) ?? { name: result.name, count: 0, incomplete: false };
        group.count += 1;
        group.incomplete ||= isIncompleteSubAgentResult(result.output);
        groups.set(result.name, group);
    }

    return [...groups.values()];
}
