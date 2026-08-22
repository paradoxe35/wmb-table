import { useCallback, useEffect, useState } from 'react';
import { message, Tag, Typography } from 'antd';
import { CloudOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { languageLabel, PROVIDER_CATALOG, voiceLanguageCode } from '@shared/tts.types';
import type {
    TtsProviderLocality,
    TtsProviderMeta,
    TtsProviderType,
    TtsSettings,
    TtsVoice,
} from '@shared/tts.types';

const { Text } = Typography;

// ── Shared props ──

export interface ProviderConfigProps {
    settings: TtsSettings;
    onUpdate: (s: Partial<TtsSettings>) => void;
}

interface HintProps {
    children: string;
}

interface FieldProps {
    label: string;
    hint?: string;
    children: React.ReactNode;
}

interface LocalityTagProps {
    type: TtsProviderLocality;
}

// ── Helpers ──

export function formatBytes(bytes: number, t: TFunction): string {
    if (bytes < 1024) return `${bytes} ${t('o')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t('Ko')}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('Mo')}`;
}

export function providerUpdate(
    settings: TtsSettings,
    provider: TtsProviderType,
    field: string,
    value: unknown,
): Partial<TtsSettings> {
    return {
        providers: {
            ...settings.providers,
            [provider]: { ...settings.providers[provider], [field]: value },
        },
    };
}

export function groupVoicesByLanguage(
    voices: TtsVoice[],
    uiLanguage: string,
    contentLanguage?: string,
) {
    const langPrefix = contentLanguage ? voiceLanguageCode(contentLanguage) : '';
    const filtered = langPrefix
        ? voices.filter((v) =>
              v.languageCodes.some((languageCode) => languageCode.startsWith(langPrefix)),
          )
        : voices;
    const list = filtered.length > 0 ? filtered : voices;

    const groups = new Map<string, TtsVoice[]>();
    for (const v of list) {
        const lang =
            v.languageCodes.find((languageCode) => languageCode.startsWith(langPrefix)) ??
            v.languageCodes[0] ??
            'other';

        if (!groups.has(lang)) {
            groups.set(lang, []);
        }
        groups.get(lang)!.push(v);
    }

    return Array.from(groups.entries()).map(([lang, items]) => ({
        label: languageLabel(lang, uiLanguage),
        options: items.map((v) => ({
            label: v.name,
            value: v.id,
        })),
    }));
}

// ── UI components ──

export function Hint({ children }: HintProps) {
    return (
        <Text
            type="secondary"
            style={{ fontSize: 'var(--fs-rel-lg)', display: 'block', marginTop: 2 }}
        >
            {children}
        </Text>
    );
}

export function Field({ label, hint, children }: FieldProps) {
    return (
        <div>
            <Text strong style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                {label}
            </Text>
            {hint && <Hint>{hint}</Hint>}
            <div style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}

export function LocalityTag({ type }: LocalityTagProps) {
    const { t } = useTranslation();
    return type === 'local' ? (
        <Tag color="green" icon={<LaptopOutlined />}>
            {t('Local')}
        </Tag>
    ) : (
        <Tag color="blue" icon={<CloudOutlined />}>
            {t('Cloud')}
        </Tag>
    );
}

export function FreeTag() {
    const { t } = useTranslation();
    return <Tag color="green">{t('Gratuit')}</Tag>;
}

export function ApiKeyLink({ provider }: { provider: TtsProviderType }) {
    const { t } = useTranslation();
    const meta = PROVIDER_CATALOG[provider] as TtsProviderMeta;
    const url = meta.apiKeyUrl;
    if (!url) return null;

    return (
        <Text
            type="secondary"
            style={{ fontSize: 'var(--fs-rel-lg)', cursor: 'pointer' }}
            onClick={() => window.api.app.openExternal(url)}
        >
            <a style={{ fontSize: 'inherit' }}>{t('Obtenir une clé API')}</a>
        </Text>
    );
}

export interface ModelDownloadState {
    percentage: number;
    phase?: string;
}

/**
 * Follows the main process download push for one provider. Progress arrives per model, so a
 * reader can queue several and watch each independently.
 */
export function useModelDownloads(
    provider: TtsProviderType,
    onInstalled: () => void,
): {
    downloads: Map<string, ModelDownloadState>;
    start: (modelName: string) => void;
} {
    const { t } = useTranslation();
    const [downloads, setDownloads] = useState(new Map<string, ModelDownloadState>());

    const forget = useCallback((modelName: string) => {
        setDownloads((previous) => {
            const next = new Map(previous);
            next.delete(modelName);
            return next;
        });
    }, []);

    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((event) => {
            if (event.provider !== provider || !event.modelName) return;

            if (event.status === 'complete') {
                forget(event.modelName);
                message.success(t('Voix installée'));
                onInstalled();
            } else if (event.status === 'error') {
                forget(event.modelName);
                message.error(t('Erreur: {{error}}', { error: t(event.error ?? '') }));
            } else {
                setDownloads((previous) =>
                    new Map(previous).set(event.modelName!, {
                        percentage: event.percentage,
                        phase: event.phase,
                    }),
                );
            }
        });
    }, [forget, onInstalled, provider, t]);

    const start = useCallback(
        (modelName: string) => {
            setDownloads((previous) =>
                new Map(previous).set(modelName, { percentage: 0, phase: 'downloading' }),
            );
            void window.api.tts.downloadModel(provider, modelName).catch(() => {});
        },
        [provider],
    );

    return { downloads, start };
}
