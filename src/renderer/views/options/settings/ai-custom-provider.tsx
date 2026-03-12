import { Button, Form, Input, Popover } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiCustomProviderConfig } from '@shared/ai.types';

const EMPTY_DRAFT: AiCustomProviderConfig = {
    id: '',
    name: '',
    baseUrl: '',
    apiKey: '',
    enabled: false,
    models: [],
    defaultModel: '',
};

export default function AiCustomProviderForm({
    onAdd,
}: {
    onAdd: (provider: AiCustomProviderConfig) => void;
}) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [open, setOpen] = useState(false);

    function handleAdd() {
        if (!draft.id || !draft.name || !draft.baseUrl) return;
        onAdd(draft);
        setDraft(EMPTY_DRAFT);
        setOpen(false);
    }

    const content = (
        <Form layout="vertical" style={{ width: 280 }}>
            <Form.Item label={t('Identifiant')} style={{ marginBottom: 8 }}>
                <Input
                    value={draft.id}
                    onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                    placeholder={t('ex: mon-service')}
                />
            </Form.Item>
            <Form.Item label={t('Nom affiché')} style={{ marginBottom: 8 }}>
                <Input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
            </Form.Item>
            <Form.Item label={t('URL de base')} style={{ marginBottom: 8 }}>
                <Input
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                    placeholder="http://127.0.0.1:1234/v1"
                />
            </Form.Item>
            <Form.Item label={t('Clé API')} style={{ marginBottom: 8 }}>
                <Input.Password
                    value={draft.apiKey}
                    onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                    placeholder={t('Optionnel')}
                />
            </Form.Item>
            <Form.Item label={t('Modèle par défaut')} style={{ marginBottom: 8 }}>
                <Input
                    value={draft.defaultModel ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, defaultModel: e.target.value }))}
                    placeholder={t('ex: gpt-4o-mini')}
                />
            </Form.Item>
            <Button
                type="primary"
                size="small"
                onClick={handleAdd}
                disabled={!draft.id || !draft.name || !draft.baseUrl}
            >
                {t('Ajouter')}
            </Button>
        </Form>
    );

    return (
        <Popover
            content={content}
            title={t('Ajouter un fournisseur')}
            trigger="click"
            open={open}
            onOpenChange={setOpen}
        >
            <Button size="small" icon={<PlusOutlined />}>
                {t('Ajouter')}
            </Button>
        </Popover>
    );
}
