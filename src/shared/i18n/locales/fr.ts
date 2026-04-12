import en from './en';

const frOverrides: Record<string, string> = {
    // Add explicit French overrides here when a key should not map to itself.
    "moins d'une minute": "moins d'une minute",
    'environ une minute': 'environ une minute',
    '{{count}} minutes': '{{count}} minutes',
    'environ une heure': 'environ une heure',
    'environ {{count}} heures': 'environ {{count}} heures',
    'un jour': 'un jour',
    '{{count}} jours': '{{count}} jours',
    'une semaine': 'une semaine',
    '{{count}} semaines': '{{count}} semaines',
    'environ un mois': 'environ un mois',
    '{{count}} mois': '{{count}} mois',
    'environ un an': 'environ un an',
    '{{count}} ans': '{{count}} ans',
};

const fr = {
    ...Object.fromEntries(Object.keys(en).map((key) => [key, key])),
    ...frOverrides,
};

export default fr;
