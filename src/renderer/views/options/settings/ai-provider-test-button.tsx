import { useEffect, useState } from 'react';
import { Button, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { resolveActiveModel } from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores';
import { getErrorMessage } from '@renderer/utils/functions';
import { classifyProviderTestError, PROVIDER_TEST_FAILURE_TEXT } from './ai-provider-test-error';

const { Paragraph } = Typography;

type TestState =
    | { status: 'idle' | 'testing' | 'success' }
    | { status: 'error'; summary: string; detail?: string };

/**
 * Tests the saved settings of the active provider. It first waits for pending saves, so a value
 * typed just before the click is the one tested. `savedInputs` resets the result when they change.
 */
export function ProviderTestButton({
    providerId,
    savedInputs,
}: {
    providerId: string;
    savedInputs: string;
}) {
    const { t, i18n } = useTranslation();
    const testProvider = useAiChatStore((s) => s.testProvider);
    const whenSettingsSaved = useAiChatStore((s) => s.whenSettingsSaved);
    const activeModel = useAiChatStore((s) => (s.settings ? resolveActiveModel(s.settings) : null));
    const [state, setState] = useState<TestState>({ status: 'idle' });

    useEffect(() => {
        setState({ status: 'idle' });
    }, [providerId, savedInputs]);

    function failure(raw: string): TestState {
        if (i18n.exists(raw)) return { status: 'error', summary: t(raw) };
        const summary = t(PROVIDER_TEST_FAILURE_TEXT[classifyProviderTestError(raw)]);
        return { status: 'error', summary, detail: raw };
    }

    async function handleTest() {
        setState({ status: 'testing' });
        try {
            await whenSettingsSaved();
            const settings = useAiChatStore.getState().settings;
            const model = settings ? resolveActiveModel(settings) : null;
            if (!model) {
                setState({ status: 'idle' });
                return;
            }
            const result = await testProvider({ providerId, model });
            setState(result.valid ? { status: 'success' } : failure(result.error ?? ''));
        } catch (error) {
            setState(failure(getErrorMessage(error, '')));
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                    size="small"
                    onClick={() => void handleTest()}
                    disabled={!activeModel || state.status === 'testing'}
                    loading={state.status === 'testing'}
                >
                    {t('Tester la connexion')}
                </Button>
                {state.status === 'success' ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        {t('Connecté')}
                    </Tag>
                ) : null}
                {state.status === 'error' ? (
                    <Tag icon={<CloseCircleOutlined />} color="error">
                        {t('Échec')}
                    </Tag>
                ) : null}
            </div>
            {state.status === 'error' ? (
                <div role="alert" style={{ marginTop: 6 }}>
                    <Paragraph type="danger" style={{ marginBottom: 2 }}>
                        {state.summary}
                    </Paragraph>
                    {state.detail ? (
                        <Paragraph
                            type="secondary"
                            style={{ fontSize: 'var(--fs-rel-lg)', marginBottom: 0 }}
                            ellipsis={{ rows: 2, expandable: true }}
                        >
                            {state.detail}
                        </Paragraph>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
