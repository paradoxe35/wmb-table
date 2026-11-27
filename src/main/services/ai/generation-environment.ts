import type { LanguageModel } from 'ai';
import log from '@main/lib/logger';
import * as configRepo from '@main/database/repositories/config.repository';
import * as languagePackService from '@main/services/language-pack.service';
import * as bibleService from '@main/services/bible.service';
import { RECOMMENDED_MIN_CONTEXT_WINDOW, resolveProviderBaseUrl } from '@shared/ai.types';
import type { AiSettings } from '@shared/ai.types';
import type { InstalledLanguage } from '@shared/types';
import { resolveUiLanguage } from '@shared/constants';
import { resolveActiveModel, resolveLanguageModel } from './provider-resolver';
import { getModelLimits, getModelReasoningSupport } from './model-fetcher';
import { isLocalProvider, resolveChatTimeouts, type ChatTimeouts } from './model-timeouts';
import type { ModelLimits } from './token-budget';

export interface GenerationEnvironment {
    settings: AiSettings;
    providerId: string;
    modelId: string;
    contentLanguageCode: string;
    uiLanguageCode: string;
    activeBibleVersion?: string;
    modelLimits: ModelLimits;
    model: LanguageModel;
    installedLanguages: InstalledLanguage[];
    timeouts: ChatTimeouts;
    reasoningControl: boolean;
}

const OPENAI_REASONING_MODEL = /^(o\d|gpt-5)(?![\w.-]*-chat)/i;
const GEMINI_THINKING_MODEL = /^gemini-(2\.5|[3-9])/i;

/**
 * A reasoning level goes only to models known to take one: others (llama3.2 on Ollama, many
 * custom servers) answer 400. Claude turns it into extended thinking, whose blocks must
 * round-trip between tool steps; the reasoning filter in model-wrapper strips them.
 */
export async function supportsReasoningControl(
    providerId: string,
    modelId: string,
    baseUrl?: string,
): Promise<boolean> {
    if (providerId === 'claude') return false;
    if (providerId === 'openai') return OPENAI_REASONING_MODEL.test(modelId);
    if (providerId === 'gemini') return GEMINI_THINKING_MODEL.test(modelId);
    return (await getModelReasoningSupport(providerId, modelId, baseUrl)) === true;
}

function requireContentLanguage(): string {
    const contentLanguageCode = configRepo.getContentLanguage();
    if (!contentLanguageCode) {
        throw new Error(
            'Aucune langue sélectionnée. Veuillez choisir une langue dans les paramètres.',
        );
    }
    return contentLanguageCode;
}

function checkContextWindow(providerId: string, modelId: string, contextWindow?: number): void {
    // An unknown window stays allowed: it cannot be proven too small, and refusing would
    // block custom providers the registries do not list.
    if (contextWindow == null) {
        log.warn('Unknown context window — proceeding without a verified limit', {
            providerId,
            modelId,
        });
        return;
    }

    if (contextWindow < RECOMMENDED_MIN_CONTEXT_WINDOW) {
        log.warn('Model rejected: context window below the supported minimum', {
            providerId,
            modelId,
            contextWindow,
            minRequired: RECOMMENDED_MIN_CONTEXT_WINDOW,
        });
        throw new Error(
            "Ce modèle est trop limité pour l'assistant. Choisissez-en un autre dans les paramètres.",
        );
    }
}

export async function resolveGenerationEnvironment(
    settings: AiSettings,
): Promise<GenerationEnvironment> {
    const providerId = settings.activeProvider;
    if (!providerId) {
        throw new Error(
            'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.',
        );
    }

    const modelId = resolveActiveModel(settings);
    if (!modelId) {
        throw new Error(
            'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.',
        );
    }

    const contentLanguageCode = requireContentLanguage();
    const uiLanguageCode = resolveUiLanguage(configRepo.getUiLanguage(), contentLanguageCode);
    const resolvedBibleVersion = bibleService.getResolvedBibleVersionForLanguage(
        contentLanguageCode,
        configRepo.getActiveBibleVersionAbbreviation(),
    );
    const providerBaseUrl = resolveProviderBaseUrl(settings, providerId);

    const modelLimits = await getModelLimits(providerId, modelId, providerBaseUrl);
    checkContextWindow(providerId, modelId, modelLimits.contextWindow);

    const model = resolveLanguageModel({ settings, providerId, modelId, baseUrl: providerBaseUrl });
    const installedLanguages = await languagePackService.getInstalledLanguages();

    return {
        settings,
        providerId,
        modelId,
        contentLanguageCode,
        uiLanguageCode,
        activeBibleVersion: resolvedBibleVersion?.abbreviation,
        modelLimits: {
            contextWindow: modelLimits.contextWindow,
            maxOutputTokens: modelLimits.maxOutputTokens,
        },
        model,
        installedLanguages,
        timeouts: resolveChatTimeouts(isLocalProvider(providerId, providerBaseUrl)),
        reasoningControl: await supportsReasoningControl(providerId, modelId, providerBaseUrl),
    };
}
