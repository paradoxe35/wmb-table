import { Tag, Typography } from 'antd';
import { CloudOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LANG_LABELS_FR, PROVIDER_CATALOG } from '@shared/tts.types';
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

export function groupVoicesByLanguage(voices: TtsVoice[], contentLanguage?: string) {
    const langPrefix = contentLanguage?.split('-')[0].toLowerCase() ?? '';
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
        label: LANG_LABELS_FR[lang] ?? lang,
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
