import { Tag, Typography } from 'antd';
import { CloudOutlined, LaptopOutlined } from '@ant-design/icons';
import type { TtsProviderType, TtsSettings, TtsVoice } from '@shared/tts.types';

const { Text } = Typography;

// ── Constants ──

export const PROVIDER_LABELS: Record<TtsProviderType, string> = {
    browser: 'Navigateur (SpeechSynthesis)',
    kokoro: 'Kokoro TTS (local)',
    sherpa: 'Sherpa-ONNX TTS (local)',
    qwen: 'Qwen AI TTS (DashScope)',
    openai: 'OpenAI TTS',
};

export const PROVIDER_HINTS: Record<TtsProviderType, string> = {
    browser:
        'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.',
    kokoro: 'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.',
    sherpa: 'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.',
    qwen: 'Très bonne qualité. Permet de créer une voix personnalisée. Nécessite un compte et une connexion internet.',
    openai: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
};

const LANG_LABELS: Record<string, string> = {
    en: 'Anglais',
    fr: 'Français',
    es: 'Espagnol',
    ja: 'Japonais',
    zh: 'Chinois',
    hi: 'Hindi',
    it: 'Italien',
    pt: 'Portugais',
};

// ── Shared props ──

export interface ProviderConfigProps {
    settings: TtsSettings;
    onUpdate: (s: Partial<TtsSettings>) => void;
}

// ── Helpers ──

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
        label: LANG_LABELS[lang] ?? lang,
        options: items.map((v) => ({
            label: `${v.name} (${v.gender === 'female' ? 'F' : 'M'})`,
            value: v.id,
        })),
    }));
}

// ── UI components ──

export function Hint({ children }: { children: string }) {
    return (
        <Text type="secondary" style={{ fontSize: '0.8em', display: 'block', marginTop: 2 }}>
            {children}
        </Text>
    );
}

export function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
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

export function LocalityTag({ type }: { type: 'local' | 'remote' }) {
    return type === 'local' ? (
        <Tag color="green" icon={<LaptopOutlined />}>
            Local
        </Tag>
    ) : (
        <Tag color="blue" icon={<CloudOutlined />}>
            Cloud
        </Tag>
    );
}
