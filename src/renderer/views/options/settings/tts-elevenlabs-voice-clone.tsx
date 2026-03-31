import { useCallback, useRef, useState } from 'react';
import { Button, Input, message, Select, Space, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TtsProviderType, TtsVoice } from '@shared/tts.types';
import { LANG_LABELS_NATIVE } from '@shared/tts.types';
import { getErrorMessage } from '@renderer/utils/functions';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { Field } from './tts-shared';

const { Text } = Typography;

interface VoiceCloneFormProps {
    providerType: TtsProviderType;
    onCloned: (voiceId: string) => void;
    /** When provided, shows a language selector with these language codes. */
    languages?: string[];
}

interface ClonedVoicesListProps {
    voices: TtsVoice[];
    onDelete: (voiceId: string) => void;
}

export function ClonedVoicesList({ voices, onDelete }: ClonedVoicesListProps) {
    const { t } = useTranslation();
    if (voices.length === 0) {
        return null;
    }

    return (
        <Field label={t('Voix clonées')} hint={t('Vos voix personnalisées.')}>
            <div>
                {voices.map((v) => (
                    <div
                        key={v.id}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '4px 0',
                        }}
                    >
                        <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>{v.name}</Text>
                        <DeleteBtn confirm={() => onDelete(v.id)} />
                    </div>
                ))}
            </div>
        </Field>
    );
}

export function VoiceCloneForm({ providerType, onCloned, languages }: VoiceCloneFormProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [language, setLanguage] = useState(languages?.[1] ?? languages?.[0] ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [cloning, setCloning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClone = useCallback(async () => {
        if (!name || !file) return;
        setCloning(true);
        try {
            const arrayBuf = await file.arrayBuffer();
            const audioBase64 = btoa(
                new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), ''),
            );
            const result = await window.api.tts.cloneVoice(providerType, {
                name,
                audioBase64,
                ...(language ? { language } : {}),
            });
            message.success(t('Voix clonée avec succès'));
            setName('');
            setFile(null);
            onCloned(result.voiceId);
        } catch (err) {
            message.error(t('Erreur: {{error}}', { error: getErrorMessage(err) }));
        } finally {
            setCloning(false);
        }
    }, [name, file, language, providerType, onCloned, t]);

    return (
        <Field
            label={t('Cloner une voix')}
            hint={t(
                'Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix.',
            )}
        >
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                        placeholder={t('Nom de la voix (ex: MaVoix)')}
                        size="small"
                        value={name}
                        maxLength={16}
                        style={{ flex: 1 }}
                        onChange={(e) => {
                            setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
                        }}
                    />
                    {languages && (
                        <Select
                            style={{ flex: 1 }}
                            size="small"
                            value={language}
                            showSearch
                            optionFilterProp="label"
                            placeholder={t('Langue de la voix')}
                            onChange={setLanguage}
                            options={languages.map((code) => ({
                                label: LANG_LABELS_NATIVE[code] ?? code,
                                value: code,
                            }))}
                        />
                    )}
                </div>
                <Space size="small">
                    <Button
                        icon={<UploadOutlined />}
                        size="small"
                        onClick={() => {
                            fileInputRef.current?.click();
                        }}
                    >
                        {file ? file.name : t('Choisir un fichier audio')}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".wav,.mp3,.m4a"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            setFile(e.target.files?.[0] ?? null);
                        }}
                    />
                    <Button
                        type="primary"
                        size="small"
                        disabled={!name || !file || cloning}
                        loading={cloning}
                        onClick={handleClone}
                    >
                        {t('Cloner')}
                    </Button>
                </Space>
            </Space>
        </Field>
    );
}
