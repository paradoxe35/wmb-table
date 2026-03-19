import { Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores/app.store';
import type { TtsProviderInfo } from '@shared/tts.types';
import {
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    type ProviderConfigProps,
} from './tts-shared';

interface EdgeConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function EdgeConfig({ settings, info, onUpdate }: EdgeConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.edge;
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const voiceGroups = groupVoicesByLanguage(info?.voices ?? [], contentLanguage ?? undefined);

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Voix')}
                hint={t(
                    'Sélectionnez une voix parmi les centaines disponibles, classées par langue.',
                )}
            >
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'fr-FR-DeniseNeural'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'edge', 'voiceId', v))}
                    options={voiceGroups}
                    filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                />
            </Field>
        </Space>
    );
}
