import en from './en';

const frOverrides: Record<string, string> = {
    // Add explicit French overrides here when a key should not map to itself.
    '{{count}}min': '{{count}}min',
    '{{count}}h': '{{count}}h',
    '{{count}}j': '{{count}}j',
    '{{count}}sem': '{{count}}sem',
    '{{count}}mois': '{{count}}mois',
    '{{count}}a': '{{count}}a',
};

const fr = {
    ...Object.fromEntries(Object.keys(en).map((key) => [key, key])),
    ...frOverrides,
};

export default fr;
