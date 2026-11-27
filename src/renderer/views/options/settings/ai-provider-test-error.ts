export type ProviderTestFailure = 'auth' | 'not-found' | 'network' | 'unknown';

const FAILURE_PATTERNS: [ProviderTestFailure, RegExp][] = [
    ['auth', /\b(401|403)\b|unauthori[sz]ed|forbidden|api[ _-]?key|authenticat|permission/i],
    [
        'network',
        /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|timed? ?out|cannot connect|socket/i,
    ],
    ['not-found', /\b404\b|not[ _-]?found|does not exist|no such model|unknown model/i],
];

export function classifyProviderTestError(message: string): ProviderTestFailure {
    return FAILURE_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0] ?? 'unknown';
}

export const PROVIDER_TEST_FAILURE_TEXT: Record<ProviderTestFailure, string> = {
    auth: 'La clé API a été refusée. Vérifiez-la puis réessayez.',
    'not-found': "Le modèle ou l'adresse est introuvable. Vérifiez le modèle et l'URL de base.",
    network: "Impossible de joindre le serveur. Vérifiez l'URL de base et votre connexion.",
    unknown: 'La connexion a échoué.',
};
