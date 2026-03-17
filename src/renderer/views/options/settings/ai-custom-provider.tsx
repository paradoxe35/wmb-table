import { Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiCustomProviderConfig } from '@shared/ai.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

interface AiCustomProviderModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (provider: AiCustomProviderConfig) => void;
    existingIds: string[];
}

const EMPTY_DRAFT = {
    name: '',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
};

export default function AiCustomProviderModal({
    open,
    onClose,
    onAdd,
    existingIds,
}: AiCustomProviderModalProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(EMPTY_DRAFT);

    const id = slugify(draft.name);
    const allReservedIds = [...(BUILTIN_PROVIDER_IDS as readonly string[]), ...existingIds];
    const isDuplicate = id.length > 0 && allReservedIds.includes(id);

    function handleSave() {
        if (!id || !draft.name || !draft.baseUrl || !draft.defaultModel.trim() || isDuplicate) {
            return;
        }
        onAdd({
            id,
            name: draft.name,
            baseUrl: draft.baseUrl,
            apiKey: draft.apiKey || undefined,
            defaultModel: draft.defaultModel.trim(),
        });
        setDraft(EMPTY_DRAFT);
        onClose();
    }

    function handleCancel() {
        setDraft(EMPTY_DRAFT);
        onClose();
    }

    const canSave =
        draft.name.trim().length > 0 &&
        draft.baseUrl.trim().length > 0 &&
        draft.defaultModel.trim().length > 0 &&
        !isDuplicate;

    return (
        <Modal
            title={t('Ajouter un fournisseur')}
            open={open}
            onOk={handleSave}
            onCancel={handleCancel}
            okText={t('Ajouter')}
            cancelText={t('Annuler')}
            okButtonProps={{ disabled: !canSave }}
            destroyOnHidden
            width={420}
        >
            <Form layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                    label={t('Nom affiché')}
                    style={{ marginBottom: 12 }}
                    required
                    validateStatus={isDuplicate ? 'error' : undefined}
                    help={isDuplicate ? t('Un fournisseur avec ce nom existe déjà.') : undefined}
                >
                    <Input
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder={t('ex: Mon Service IA')}
                    />
                </Form.Item>
                <Form.Item label={t('URL de base')} style={{ marginBottom: 12 }} required>
                    <Input
                        value={draft.baseUrl}
                        onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                        placeholder="http://127.0.0.1:1234/v1"
                    />
                </Form.Item>
                <Form.Item label={t('Clé API')} style={{ marginBottom: 12 }}>
                    <Input.Password
                        value={draft.apiKey}
                        onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                        placeholder={t('Optionnel')}
                    />
                </Form.Item>
                <Form.Item label={t('Modèle par défaut')} style={{ marginBottom: 0 }} required>
                    <Input
                        value={draft.defaultModel}
                        onChange={(e) => setDraft((d) => ({ ...d, defaultModel: e.target.value }))}
                        placeholder={t('ex: gpt-4o-mini')}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
