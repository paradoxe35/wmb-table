import type { TFunction } from 'i18next';
import { getErrorMessage } from '@renderer/utils/functions';

const NETWORK_ERROR_PATTERNS = [
    /fetch failed/i,
    /network/i,
    /offline/i,
    /internet/i,
    /timed?\s*out/i,
    /timeout/i,
    /enotfound/i,
    /econnrefused/i,
    /econnreset/i,
    /ehostunreach/i,
    /enetunreach/i,
    /getaddrinfo/i,
    /socket hang up/i,
    /client network socket disconnected/i,
    /unable to connect/i,
    /connection (?:failed|closed|lost|refused|reset)/i,
    /websocket error/i,
];

const USER_FACING_TTS_ERROR_PATTERNS = [
    /^La clé API /,
    /^Fournisseur TTS /,
    /^Ce fournisseur ne prend pas /,
    /^Aucune voix Cartesia /,
    /^La synthèse du navigateur /,
    /^Le service de voix Edge /,
];

function isNetworkErrorMessage(message: string): boolean {
    return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isUserFacingTtsErrorMessage(message: string): boolean {
    return USER_FACING_TTS_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getTtsPlaybackErrorMessage(t: TFunction, error?: unknown): string {
    const message = getErrorMessage(error, '').trim();

    if (message && isNetworkErrorMessage(message)) {
        return t('Connexion internet indisponible. Vérifiez votre connexion et réessayez.');
    }

    if (message && isUserFacingTtsErrorMessage(message)) {
        return t(message);
    }

    return t('La lecture audio a échoué. Vérifiez la configuration du fournisseur.');
}
