import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AiProviderDefinition } from '@shared/ai.types';

const { Text } = Typography;

export function Hint({ children }: { children: string }) {
    return (
        <Text
            type="secondary"
            style={{ fontSize: 'var(--fs-rel-lg)', display: 'block', marginTop: 2 }}
        >
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
            <Text strong style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                {label}
            </Text>
            {hint ? <Hint>{hint}</Hint> : null}
            <div style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}

export function ApiKeyLink({ provider }: { provider: AiProviderDefinition }) {
    const { t } = useTranslation();
    const url = provider.apiKeyUrl;
    if (!url) return null;

    return (
        <Text
            type="secondary"
            style={{ fontSize: 'var(--fs-rel-lg)', cursor: 'pointer' }}
            onClick={() => void window.api.app.openExternal(url)}
        >
            <a style={{ fontSize: 'inherit' }}>{t('Obtenir une clé API')}</a>
        </Text>
    );
}
