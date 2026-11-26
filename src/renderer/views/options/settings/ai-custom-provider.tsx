import { Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiCustomProviderConfig } from '@shared/ai.types';
import { describeBaseUrlProblem } from './ai-shared';
import {
    checkCustomProviderDraft,
    EMPTY_CUSTOM_PROVIDER_DRAFT,
    type CustomProviderDraft,
} from './ai-custom-provider-draft';

interface AiCustomProviderModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (provider: AiCustomProviderConfig) => void;
    takenIds: string[];
    takenNames: string[];
}

export default function AiCustomProviderModal({
    open,
    onClose,
    onAdd,
    takenIds,
    takenNames,
}: AiCustomProviderModalProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(EMPTY_CUSTOM_PROVIDER_DRAFT);
    const check = checkCustomProviderDraft(draft, { ids: takenIds, names: takenNames });
    const baseUrlProblem = draft.baseUrl.trim() ? check.baseUrlProblem : undefined;

    function setField(field: keyof CustomProviderDraft, value: string) {
        setDraft((current) => ({ ...current, [field]: value }));
    }

    function close() {
        setDraft(EMPTY_CUSTOM_PROVIDER_DRAFT);
        onClose();
    }

    function handleSave() {
        if (!check.provider) return;
        onAdd(check.provider);
        close();
    }

    return (
        <Modal
            title={t('Ajouter un fournisseur')}
            open={open}
            onOk={handleSave}
            onCancel={close}
            okText={t('Ajouter')}
            cancelText={t('Annuler')}
            okButtonProps={{ disabled: !check.provider }}
            destroyOnHidden
            width={420}
        >
            <Form layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                    label={t('Nom affiché')}
                    htmlFor="ai-custom-provider-name"
                    style={{ marginBottom: 12 }}
                    required
                    validateStatus={check.duplicateName ? 'error' : undefined}
                    help={
                        check.duplicateName
                            ? t('Un fournisseur avec ce nom existe déjà.')
                            : undefined
                    }
                >
                    <Input
                        id="ai-custom-provider-name"
                        value={draft.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder={t('ex: Mon Service IA')}
                    />
                </Form.Item>
                <Form.Item
                    label={t('URL de base')}
                    htmlFor="ai-custom-provider-base-url"
                    style={{ marginBottom: 12 }}
                    required
                    validateStatus={baseUrlProblem ? 'error' : undefined}
                    help={baseUrlProblem ? describeBaseUrlProblem(t, baseUrlProblem) : undefined}
                    extra={t('Compatible avec l’API OpenAI.')}
                >
                    <Input
                        id="ai-custom-provider-base-url"
                        value={draft.baseUrl}
                        onChange={(e) => setField('baseUrl', e.target.value)}
                        placeholder="http://127.0.0.1:1234/v1"
                    />
                </Form.Item>
                <Form.Item
                    label={t('Clé API')}
                    htmlFor="ai-custom-provider-api-key"
                    style={{ marginBottom: 12 }}
                >
                    <Input.Password
                        id="ai-custom-provider-api-key"
                        value={draft.apiKey}
                        onChange={(e) => setField('apiKey', e.target.value)}
                        placeholder={t('Optionnel')}
                    />
                </Form.Item>
                <Form.Item
                    label={t('Modèle par défaut')}
                    htmlFor="ai-custom-provider-model"
                    style={{ marginBottom: 0 }}
                    required
                >
                    <Input
                        id="ai-custom-provider-model"
                        value={draft.defaultModel}
                        onChange={(e) => setField('defaultModel', e.target.value)}
                        placeholder={t('ex: gpt-4o-mini')}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
