import { useCallback, useRef, useState } from 'react';
import { Button, Input, message, Space, Typography } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { TtsVoice } from '@shared/tts.types';
import { Field } from './tts-shared';

const { Text } = Typography;

interface VoiceCloneFormProps {
    onCloned: (voiceId: string) => void;
}

interface ClonedVoicesListProps {
    voices: TtsVoice[];
    onDelete: (voiceId: string) => void;
}

export function ClonedVoicesList({ voices, onDelete }: ClonedVoicesListProps) {
    if (voices.length === 0) return null;

    return (
        <Field label="Voix clonées" hint="Vos voix personnalisées.">
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
                        <Text style={{ fontSize: '0.9em' }}>{v.name}</Text>
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => onDelete(v.id)}
                        />
                    </div>
                ))}
            </div>
        </Field>
    );
}

export function VoiceCloneForm({ onCloned }: VoiceCloneFormProps) {
    const [name, setName] = useState('');
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
            const result = await window.api.tts.cloneVoice({ name, audioBase64 });
            message.success('Voix clonée avec succès');
            setName('');
            setFile(null);
            onCloned(result.voiceId);
        } catch (err) {
            message.error(`Erreur: ${(err as Error).message}`);
        } finally {
            setCloning(false);
        }
    }, [name, file, onCloned]);

    return (
        <Field
            label="Cloner une voix"
            hint="Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix."
        >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Input
                    placeholder="Nom de la voix (ex: MaVoix)"
                    size="small"
                    value={name}
                    maxLength={16}
                    onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                />
                <Space size="small">
                    <Button
                        icon={<UploadOutlined />}
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {file ? file.name : 'Choisir un fichier audio'}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".wav,.mp3,.m4a"
                        style={{ display: 'none' }}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                        type="primary"
                        size="small"
                        disabled={!name || !file || cloning}
                        loading={cloning}
                        onClick={handleClone}
                    >
                        Cloner
                    </Button>
                </Space>
            </Space>
        </Field>
    );
}
