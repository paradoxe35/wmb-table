type DefaultExport<T> = { default: T };

function hasDefaultExport<T>(moduleValue: unknown): moduleValue is DefaultExport<T> {
    return typeof moduleValue === 'object' && moduleValue !== null && 'default' in moduleValue;
}

export function resolveDefaultExport<T>(moduleValue: T | DefaultExport<T>): T {
    return hasDefaultExport<T>(moduleValue) ? moduleValue.default : moduleValue;
}
