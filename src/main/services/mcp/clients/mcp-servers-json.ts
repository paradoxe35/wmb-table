import { isDeepStrictEqual } from 'node:util';

type JsonObject = Record<string, unknown>;

export interface McpServersConfig {
    root: JsonObject;
    indent: string;
    trailingNewline: boolean;
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detectIndent(text: string): string {
    return /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
}

/** Null when the text is not a JSON object with an object `mcpServers`: then nothing is written. */
export function parseMcpServersConfig(text: string): McpServersConfig | null {
    if (text.trim() === '') return { root: {}, indent: '  ', trailingNewline: true };
    let root: unknown;
    try {
        root = JSON.parse(text);
    } catch {
        return null;
    }
    if (!isObject(root)) return null;
    if (root.mcpServers !== undefined && !isObject(root.mcpServers)) return null;
    return { root, indent: detectIndent(text), trailingNewline: text.endsWith('\n') };
}

export function readServerEntry(config: McpServersConfig, name: string): unknown {
    const servers = config.root.mcpServers;
    return isObject(servers) && Object.hasOwn(servers, name) ? servers[name] : undefined;
}

export function isSameEntry(existing: unknown, wanted: unknown): boolean {
    return isDeepStrictEqual(existing, wanted);
}

/** Every other key and server keeps its value and its place; only our entry changes. */
export function withServerEntry(
    config: McpServersConfig,
    name: string,
    entry: unknown,
): McpServersConfig {
    const servers = isObject(config.root.mcpServers) ? config.root.mcpServers : {};
    return { ...config, root: { ...config.root, mcpServers: { ...servers, [name]: entry } } };
}

export function serializeMcpServersConfig(config: McpServersConfig): string {
    const text = JSON.stringify(config.root, null, config.indent);
    return config.trailingNewline ? `${text}\n` : text;
}
