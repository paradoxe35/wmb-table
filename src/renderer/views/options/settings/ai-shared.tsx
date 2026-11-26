import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AiProviderDefinition } from '@shared/ai.types';
import type { BaseUrlProblem } from '@shared/ai-provider-input';

const { Link, Text } = Typography;

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
    htmlFor,
    children,
}: {
    label: string;
    hint?: string;
    htmlFor?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <Text strong style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                <label htmlFor={htmlFor}>{label}</label>
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
        <Link
            href={url}
            style={{ fontSize: 'var(--fs-rel-lg)' }}
            onClick={(event) => {
                event.preventDefault();
                void window.api.app.openExternal(url);
            }}
        >
            {t('Obtenir une clé API')}
        </Link>
    );
}

export function describeBaseUrlProblem(t: TFunction, problem: BaseUrlProblem): string {
    if (problem === 'empty') return t("L'URL de base est requise.");
    if (problem === 'scheme') return t("L'URL doit commencer par http:// ou https://.");
    return t("Cette URL n'est pas valide.");
}
