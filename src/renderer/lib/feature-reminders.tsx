import type { ReactNode } from 'react';
import { CloudSyncOutlined, CommentOutlined, SoundOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { Trans } from 'react-i18next';
import type { SettingsTabValue } from '@renderer/stores/app.store';
import {
    useFeatureRemindersStore,
    type FeatureReminderKey,
} from '@renderer/stores/feature-reminders.store';
import type { BackupStatus } from '@shared/types';
import type { TtsProviderInfo, TtsSettings } from '@shared/tts.types';
import {
    BUILTIN_PROVIDER_IDS,
    resolveActiveModel,
    type AiBuiltinProviderId,
    type AiSettings,
} from '@shared/ai.types';

export const FEATURE_REMINDER_NOTIFICATION_KEY = 'feature-reminder';
export const FEATURE_REMINDER_SESSION_DELAY_MS = 90 * 1000;

export interface FeatureReminderDefinition {
    key: FeatureReminderKey;
    tab: SettingsTabValue;
    priority: number;
    featureLabelKey: string;
    titleKey: string;
    descriptionKey: string;
    actionLabelKey: string;
    renderIcon(): ReactNode;
}

export interface FeatureReminderBackendSnapshot {
    backupStatus: BackupStatus | null;
    aiSettings: AiSettings | null;
    aiConversationCount: number;
    ttsSettings: TtsSettings | null;
    ttsProviders: TtsProviderInfo[];
    ttsCacheSize: number;
}

export interface FeatureReminderVisibilityInput {
    hydrated: boolean;
    backendLoaded: boolean;
    loaded: boolean;
    syncing: boolean;
    readingMode: boolean;
    hasInteracted: boolean;
    sessionDelayElapsed: boolean;
    sessionHiddenUntil: number | null;
    contentLanguage: string | null;
    now?: number;
}

export async function loadFeatureReminderBackendSnapshot(): Promise<FeatureReminderBackendSnapshot> {
    const [backupStatus, aiSettings, ttsCacheSize, ttsSettings, ttsProviders, conversations] =
        await Promise.all([
            window.api.backup.getStatus(),
            window.api.ai.getSettings(),
            window.api.tts.getCacheSize(),
            window.api.tts.getSettings(),
            window.api.tts.getProviders(),
            window.api.ai.getConversations(),
        ]);

    return {
        backupStatus,
        aiSettings,
        aiConversationCount: conversations.length,
        ttsSettings,
        ttsProviders,
        ttsCacheSize,
    };
}

const FEATURE_REMINDER_DEFINITION_INPUT = [
    {
        key: 'ai',
        tab: 'ai',
        priority: 1,
        featureLabelKey: 'Assistant IA',
        titleKey:
            'Le saviez-vous ? <u>{{feature}}</u> peut vous aider à explorer un sujet et comprendre plus vite ce que vous cherchez.',
        descriptionKey:
            'Activez <u>{{feature}}</u> pour poser vos questions, approfondir un thème, comparer plusieurs prédications, retrouver des passages bibliques et obtenir des réponses claires sans tout parcourir manuellement.',
        actionLabelKey: "Ouvrir les réglages de l'assistant",
        renderIcon: () => <CommentOutlined />,
    },
    {
        key: 'tts',
        tab: 'tts',
        priority: 2,
        featureLabelKey: 'Lecture audio',
        titleKey: 'Le saviez-vous ? <u>{{feature}}</u> peut lire vos documents.',
        descriptionKey:
            'Choisissez une voix pour <u>{{feature}}</u>, puis lancez la lecture directement depuis vos documents.',
        actionLabelKey: 'Ouvrir les réglages audio',
        renderIcon: () => <SoundOutlined />,
    },
    {
        key: 'backup',
        tab: 'backup',
        priority: 3,
        featureLabelKey: 'Sauvegarde',
        titleKey: 'Le saviez-vous ? <u>{{feature}}</u> peut protéger vos données.',
        descriptionKey:
            'Connectez Google Drive pour que <u>{{feature}}</u> garde vos notes, sujets et réglages synchronisés.',
        actionLabelKey: 'Ouvrir les réglages de sauvegarde',
        renderIcon: () => <CloudSyncOutlined />,
    },
] as const satisfies readonly FeatureReminderDefinition[];

export const FEATURE_REMINDER_DEFINITIONS: FeatureReminderDefinition[] = [
    ...FEATURE_REMINDER_DEFINITION_INPUT,
].sort((a, b) => a.priority - b.priority);

export function getFeatureReminderCopy(definition: FeatureReminderDefinition, t: TFunction) {
    const feature = t(definition.featureLabelKey);

    return {
        title: (
            <Trans
                t={t}
                i18nKey={definition.titleKey}
                values={{ feature }}
                components={{ u: <u /> }}
            />
        ),
        description: (
            <Trans
                t={t}
                i18nKey={definition.descriptionKey}
                values={{ feature }}
                components={{ u: <u /> }}
            />
        ),
        actionLabel: t(definition.actionLabelKey),
    };
}

export function canDisplayFeatureReminders({
    hydrated,
    backendLoaded,
    loaded,
    syncing,
    readingMode,
    hasInteracted,
    sessionDelayElapsed,
    sessionHiddenUntil,
    contentLanguage,
    now = Date.now(),
}: FeatureReminderVisibilityInput): boolean {
    return (
        Boolean(contentLanguage) &&
        hydrated &&
        backendLoaded &&
        loaded &&
        !syncing &&
        !readingMode &&
        hasInteracted &&
        sessionDelayElapsed &&
        (!sessionHiddenUntil || sessionHiddenUntil <= now)
    );
}

export function markFeatureReminderUsed(key: FeatureReminderKey): void {
    useFeatureRemindersStore.getState().markUsed(key);
}

export function isAiConfigured(settings: AiSettings | null): boolean {
    if (!settings?.enabled || !settings.activeProvider) {
        return false;
    }

    const modelId = resolveActiveModel(settings);
    if (!modelId) {
        return false;
    }

    if ((BUILTIN_PROVIDER_IDS as readonly string[]).includes(settings.activeProvider)) {
        const providerId = settings.activeProvider as AiBuiltinProviderId;
        const providerConfig = settings.providers[providerId];
        if (!providerConfig?.enabled) {
            return false;
        }
        if (providerId === 'local') {
            return true;
        }
        return Boolean(providerConfig.apiKey?.trim());
    }

    const customProvider = settings.customProviders.find((p) => p.id === settings.activeProvider);
    return Boolean(
        customProvider?.baseUrl && (customProvider.model || customProvider.defaultModel),
    );
}

export function isTtsConfigured(
    settings: TtsSettings | null,
    providers: TtsProviderInfo[],
): boolean {
    if (!settings) {
        return false;
    }

    const activeProvider = settings.activeProvider;
    const providerConfig = settings.providers[activeProvider];

    switch (activeProvider) {
        case 'browser':
        case 'edge':
            return true;
        case 'sherpa':
            return (
                providers.find((provider) => provider.type === 'sherpa')?.modelDownloaded === true
            );
        case 'openai':
        case 'elevenlabs':
        case 'cartesia':
            return Boolean(providerConfig?.apiKey?.trim());
        default:
            return Boolean(providerConfig?.voiceId || providerConfig?.model);
    }
}

export function isFeatureReminderConfigured(
    key: FeatureReminderKey,
    snapshot: FeatureReminderBackendSnapshot,
): boolean {
    switch (key) {
        case 'ai':
            return isAiConfigured(snapshot.aiSettings);
        case 'tts':
            return isTtsConfigured(snapshot.ttsSettings, snapshot.ttsProviders);
        case 'backup':
            return Boolean(snapshot.backupStatus);
        default:
            return false;
    }
}

export function syncFeatureReminderUsageFromSnapshot(
    snapshot: FeatureReminderBackendSnapshot,
): void {
    // Mark as used if the feature has activity OR is configured (user has set it up)
    if (snapshot.backupStatus) {
        markFeatureReminderUsed('backup');
    }
    if (snapshot.ttsCacheSize > 0 || isTtsConfigured(snapshot.ttsSettings, snapshot.ttsProviders)) {
        markFeatureReminderUsed('tts');
    }
    if (snapshot.aiConversationCount > 0 || isAiConfigured(snapshot.aiSettings)) {
        markFeatureReminderUsed('ai');
    }
}
