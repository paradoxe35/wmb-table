import type { AiToolResult } from '@shared/ai.types';

export interface GroupedToolResult {
    name: string;
    count: number;
}

/**
 * Group the activity strip entries for a running answer.
 *
 * Failed calls stay in history for the assistant but are never shown: the strip speaks in
 * plain language to non-technical users, and announcing "note updated" for a call that
 * failed would tell them something untrue.
 */
export function groupToolResults(results: AiToolResult[]): GroupedToolResult[] {
    const counts = new Map<string, number>();

    for (const result of results) {
        if (result.isError) continue;
        counts.set(result.name, (counts.get(result.name) ?? 0) + 1);
    }

    return [...counts.entries()].map(([name, count]) => ({ name, count }));
}
