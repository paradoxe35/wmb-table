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

export const PROVIDER_LABELS: Record<TtsProviderType, string> = {
    browser: 'Navigateur (SpeechSynthesis)',
    sherpa: 'Sherpa-ONNX TTS (local)',
    kokoro: 'Kokoro TTS (local)',
    elevenlabs: 'ElevenLabs TTS',
    openai: 'OpenAI TTS',
};

export const PROVIDER_HINTS: Record<TtsProviderType, string> = {
    browser:
        'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.',
    sherpa: 'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.',
    kokoro: 'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.',
    elevenlabs:
        'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.',
    openai: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
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
