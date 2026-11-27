import type { AiErrorCode } from '@shared/ai.types';
import type { AiRunNotice, AiRunNoticeKind } from '@renderer/stores/ai-chat/chat-state';

export type RunNoticeAction = 'continue' | 'continue-research' | 'retry' | 'open-settings';

export interface RunNoticeCopy {
    tone: 'warning' | 'info' | 'error';
    /** An i18n key, or the raw error text when main sent no code. */
    title: string;
    /** The provider's own words, shown small under a translated title. */
    detail: string | null;
    actions: RunNoticeAction[];
}

export const RUN_NOTICE_ACTION_LABELS: Record<RunNoticeAction, string> = {
    continue: 'Continuer',
    'continue-research': 'Poursuivre la recherche',
    retry: 'Réessayer',
    'open-settings': 'Ouvrir les paramètres IA',
};

export const CONTINUE_ANSWER_PROMPT = "Continue ta réponse là où elle s'est arrêtée.";
export const CONTINUE_RESEARCH_PROMPT = 'Poursuis tes recherches, puis complète ta réponse.';

const ERROR_TITLES: Record<AiErrorCode, string> = {
    'not-configured': "L'assistant n'est pas encore configuré.",
    auth: 'Clé API refusée. Vérifiez-la dans les paramètres.',
    'model-not-found': 'Modèle introuvable chez ce fournisseur. Choisissez-en un autre.',
    'rate-limit': 'Trop de demandes pour le moment. Patientez un peu, puis réessayez.',
    quota: 'Quota ou crédit épuisé chez le fournisseur.',
    'context-too-long':
        'La conversation est trop longue pour ce modèle. Commencez une nouvelle conversation.',
    'provider-unavailable': 'Le serveur du service IA est indisponible pour le moment.',
    network: 'Connexion perdue avec le service IA. Vérifiez votre réseau.',
    timeout: "Le service IA n'a pas répondu à temps.",
    'invalid-request': 'Le service IA a refusé la demande.',
    unknown: 'Une erreur est survenue.',
};

const NOTICE_TITLES: Record<AiRunNoticeKind, string> = {
    truncated: 'Réponse coupée : elle a atteint la longueur maximale que ce modèle peut écrire.',
    'step-limit': "Recherche incomplète : la limite d'étapes a été atteinte.",
    stopped: 'Arrêté par vous.',
    empty: "Le modèle n'a renvoyé aucun texte.",
};

const FIXED_IN_SETTINGS = new Set<AiErrorCode>([
    'not-configured',
    'auth',
    'model-not-found',
    'quota',
]);

/** A wrong key or model can be fixed in the settings, then tried again. */
const RETRY_AFTER_SETTINGS = new Set<AiErrorCode>(['auth', 'model-not-found']);

/** Sending the same request again cannot help, unless main says otherwise. */
const NOT_RETRYABLE_BY_DEFAULT = new Set<AiErrorCode>([
    'not-configured',
    'quota',
    'context-too-long',
    'invalid-request',
]);

export const RUN_NOTICE_TEXT_KEYS: readonly string[] = [
    ...Object.values(NOTICE_TITLES),
    ...Object.values(ERROR_TITLES),
];

function errorCopy(notice: Extract<AiRunNotice, { kind: 'error' }>): RunNoticeCopy {
    const { code, retryable, detail } = notice;
    if (!code) {
        return {
            tone: 'error',
            title: detail,
            detail: null,
            actions: retryable === false ? [] : ['retry'],
        };
    }

    const canRetry = retryable ?? !NOT_RETRYABLE_BY_DEFAULT.has(code);
    const actions: RunNoticeAction[] = [];
    if (canRetry || RETRY_AFTER_SETTINGS.has(code)) actions.push('retry');
    if (FIXED_IN_SETTINGS.has(code)) actions.push('open-settings');

    return { tone: 'error', title: ERROR_TITLES[code], detail, actions };
}

const NOTICE_ACTIONS: Record<AiRunNoticeKind, (answerHasText: boolean) => RunNoticeAction[]> = {
    truncated: () => ['continue'],
    'step-limit': () => ['continue-research'],
    stopped: (answerHasText) => [answerHasText ? 'continue' : 'retry'],
    empty: () => ['retry'],
};

export function describeRunNotice(notice: AiRunNotice, answerHasText: boolean): RunNoticeCopy {
    if (notice.kind === 'error') {
        return errorCopy(notice);
    }

    return {
        tone: notice.kind === 'stopped' ? 'info' : 'warning',
        title: NOTICE_TITLES[notice.kind],
        detail: null,
        actions: NOTICE_ACTIONS[notice.kind](answerHasText),
    };
}
