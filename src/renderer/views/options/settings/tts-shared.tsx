import { Tag, Typography } from 'antd';
import { CloudOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LANG_LABELS_FR } from '@shared/tts.types';
import type {
    TtsProviderLocality,
    TtsProviderType,
    TtsSettings,
    TtsVoice,
} from '@shared/tts.types';

const { Text } = Typography;

// ── Constants ──

interface ProviderMeta {
    label: string;
    locality: TtsProviderLocality;
    hint: string;
    free: boolean;
}

export const PROVIDER_CATALOG: Record<TtsProviderType, ProviderMeta> = {
    browser: {
        label: 'Voix du système',
        locality: 'local',
        hint: 'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.',
        free: true,
    },
    sherpa: {
        label: 'Sherpa-ONNX TTS',
        locality: 'local',
        hint: 'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.',
        free: true,
    },
    kokoro: {
        label: 'Kokoro TTS',
        locality: 'local',
        hint: 'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.',
        free: true,
    },
    elevenlabs: {
        label: 'ElevenLabs TTS',
        locality: 'remote',
        hint: 'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.',
        free: false,
    },
    openai: {
        label: 'OpenAI TTS',
        locality: 'remote',
        hint: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
        free: false,
    },
    edge: {
        label: 'Edge TTS (Microsoft)',
        locality: 'remote',
        hint: 'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.',
        free: true,
    },
};

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

export function groupVoicesByLanguage(voices: TtsVoice[]) {
    const groups = new Map<string, TtsVoice[]>();
    for (const v of voices) {
        const lang = v.languageCodes[0] ?? 'other';
        if (!groups.has(lang)) groups.set(lang, []);
        groups.get(lang)!.push(v);
    }
    return Array.from(groups.entries()).map(([lang, items]) => ({
        label: LANG_LABELS_FR[lang] ?? lang,
        options: items.map((v) => ({
            label: `${v.name} (${v.gender === 'female' ? 'F' : 'M'})`,
            value: v.id,
        })),
    }));
}

// ── UI components ──

export function Hint({ children }: HintProps) {
    return (
        <Text type="secondary" style={{ fontSize: '0.8em', display: 'block', marginTop: 2 }}>
            {children}
        </Text>
    );
}

export function Field({ label, hint, children }: FieldProps) {
    return (
        <div>
            <Text strong style={{ fontSize: '0.9em' }}>
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
