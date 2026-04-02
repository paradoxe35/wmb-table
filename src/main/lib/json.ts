import log from 'electron-log';

type JsonParseContext = {
    scope: string;
    field?: string;
};

function describeTarget({ scope, field }: JsonParseContext): string {
    return field ? `${scope}.${field}` : scope;
}

export function parseJsonOrFallback<T>(
    raw: string | null | undefined,
    fallback: T,
    context: JsonParseContext,
): T {
    if (!raw) {
        return fallback;
    }

    try {
        return JSON.parse(raw) as T;
    } catch (err) {
        log.warn(`JSON parse failed in ${describeTarget(context)}:`, err);
        return fallback;
    }
}

export function parseRequiredJson<T>(raw: string, context: JsonParseContext): T {
    try {
        return JSON.parse(raw) as T;
    } catch (err) {
        const target = describeTarget(context);
        log.error(`Invalid JSON in ${target}:`, err);
        throw new Error(`Invalid JSON stored in ${target}`);
    }
}
