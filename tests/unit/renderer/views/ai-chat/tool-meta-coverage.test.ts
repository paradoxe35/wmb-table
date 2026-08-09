import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../../../..');
const TOOL_DIR = resolve(ROOT, 'src/main/services/ai/tools');
const AGENT_DIR = resolve(ROOT, 'src/main/services/ai/agents');
const CHAT_TOOL_RESULT = resolve(ROOT, 'src/renderer/views/options/ai-chat/chat-tool-result.tsx');

const TOOL_DEFINITION_PATTERN = /^ {8}([a-zA-Z]+): \{$/gm;
const TOOL_META_KEY_PATTERN = /^ {4}([a-zA-Z]+): \{ label:/gm;

function matchNames(source: string, pattern: RegExp): string[] {
    return [...source.matchAll(pattern)].map((match) => match[1]);
}

function readSources(directory: string, suffix: string): string {
    return readdirSync(directory)
        .filter((file) => file.endsWith(suffix))
        .map((file) => readFileSync(resolve(directory, file), 'utf8'))
        .join('\n');
}

const definedTools = new Set([
    ...matchNames(readSources(TOOL_DIR, '.tools.ts'), TOOL_DEFINITION_PATTERN),
    ...matchNames(readSources(AGENT_DIR, '-agent.ts'), TOOL_DEFINITION_PATTERN),
]);
const labelledTools = new Set(
    matchNames(readFileSync(CHAT_TOOL_RESULT, 'utf8'), TOOL_META_KEY_PATTERN),
);

describe('chat tool labels', () => {
    it('finds the tool registries', () => {
        expect(definedTools.size).toBeGreaterThan(0);
        expect(labelledTools.size).toBeGreaterThan(0);
    });

    it('labels every tool exposed to the model', () => {
        const missing = [...definedTools].filter((name) => !labelledTools.has(name));

        expect(missing).toEqual([]);
    });

    it('has no label for a tool that no longer exists', () => {
        const orphans = [...labelledTools].filter((name) => !definedTools.has(name));

        expect(orphans).toEqual([]);
    });
});
