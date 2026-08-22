import { useCallback, useEffect, useState } from 'react';
import { Button, List, message, Progress, Select, Space, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores/app.store';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useResolvedUiLanguage } from '@renderer/hooks';
import { getErrorMessage } from '@renderer/utils/functions';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { pocketVoiceBundle } from '@shared/pocket-voice-id';
import type { TtsModelInfo, TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import {
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    useModelDownloads,
    type ProviderConfigProps,
} from './tts-shared';
import { ClonedVoicesList, VoiceCloneForm } from './tts-elevenlabs-voice-clone';

const { Text } = Typography;
const PROVIDER_TYPE = 'pocket' as const;

interface PocketConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function PocketConfig({ settings, info, onUpdate }: PocketConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.pocket;
    const setProviders = useTtsStore((s) => s.setProviders);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const uiLanguage = useResolvedUiLanguage();

    const [models, setModels] = useState<TtsModelInfo[]>([]);
    const [clonedVoices, setClonedVoices] = useState<TtsVoice[]>([]);

    const refresh = useCallback(() => {
        window.api.tts
            .getProviderModels(PROVIDER_TYPE)
            .then(setModels)
            .catch(() => {});
        window.api.tts
            .listClonedVoices(PROVIDER_TYPE)
            .then(setClonedVoices)
            .catch(() => {});
        window.api.tts
            .getProviders()
            .then(setProviders)
            .catch(() => {});
    }, [setProviders]);

    useEffect(refresh, [refresh]);

    const { downloads, start } = useModelDownloads(PROVIDER_TYPE, refresh);

    const handleDelete = useCallback(
        async (bundle: string) => {
            try {
                await window.api.tts.deleteProviderModel(PROVIDER_TYPE, bundle);
                if (pocketVoiceBundle(cfg.voiceId ?? '') === bundle) {
                    onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', ''));
                }
                message.success(t('Voix supprimée'));
                refresh();
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: t(getErrorMessage(err)) }));
            }
        },
        [cfg.voiceId, onUpdate, refresh, settings, t],
    );

    const handleDeleteClone = useCallback(
        async (voiceId: string) => {
            try {
                await window.api.tts.deleteClonedVoice(PROVIDER_TYPE, voiceId);
                message.success(t('Voix clonée supprimée'));
                refresh();
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: t(getErrorMessage(err)) }));
            }
        },
        [refresh, t],
    );

    const handleCloned = useCallback(
        (voiceId: string) => {
            refresh();
            onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', voiceId));
        },
        [onUpdate, refresh, settings],
    );

    const voiceGroups = groupVoicesByLanguage(
        info?.voices ?? [],
        uiLanguage,
        contentLanguage ?? undefined,
    );

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Langue')}
                hint={t(
                    'Chaque langue est un modèle distinct à télécharger une seule fois. Tout fonctionne ensuite sans connexion.',
                )}
            >
                <List
                    size="small"
                    bordered
                    dataSource={models}
                    renderItem={(model) => {
                        const progress = downloads.get(model.modelName);
                        return (
                            <List.Item
                                actions={[
                                    model.installed ? (
                                        <DeleteBtn
                                            key="delete"
                                            confirm={() => void handleDelete(model.modelName)}
                                        />
                                    ) : progress ? (
                                        <Progress
                                            key="progress"
                                            type="circle"
                                            size={28}
                                            percent={progress.percentage}
                                        />
                                    ) : (
                                        <Button
                                            key="download"
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            onClick={() => start(model.modelName)}
                                        >
                                            {t('Installer')}
                                        </Button>
                                    ),
                                ]}
                            >
                                <Space size="small">
                                    <Text>{model.voiceName}</Text>
                                    <Text type="secondary">{model.filesizeMb} Mo</Text>
                                    {model.installed && <Tag color="green">{t('Installé')}</Tag>}
                                </Space>
                            </List.Item>
                        );
                    }}
                />
            </Field>

            <Field
                label={t('Voix')}
                hint={t('Les voix marquées « cloné » parlent avec un enregistrement de référence.')}
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId || undefined}
                    showSearch
                    optionFilterProp="label"
                    placeholder={t('Sélectionnez une voix')}
                    options={voiceGroups}
                    onChange={(value) => {
                        onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', value));
                    }}
                />
            </Field>

            <ClonedVoicesList voices={clonedVoices} onDelete={handleDeleteClone} />
            <VoiceCloneForm providerType={PROVIDER_TYPE} onCloned={handleCloned} />
        </Space>
    );
}
