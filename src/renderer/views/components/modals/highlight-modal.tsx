import { Button, Input, Modal, Space, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalVisible } from '@renderer/hooks';
import { CHILD_PARENT_WINDOW_EVENT, HIGHLIGHT_EVENT } from '@renderer/utils/events';
import type { HighlightCreateData } from '@shared/types';

type HighlightModalData = Omit<HighlightCreateData, 'color' | 'comment'>;

const PRESET_COLORS = [
    { label: 'Jaune', value: '#FFFF00' },
    { label: 'Vert clair', value: '#90EE90' },
    { label: 'Bleu ciel', value: '#87CEEB' },
    { label: 'Rose', value: '#FFB6C1' },
    { label: 'Orange', value: '#FFD700' },
    { label: 'Violet', value: '#DDA0DD' },
    { label: 'Menthe', value: '#98FFD6' },
    { label: 'Pêche', value: '#FFDAB9' },
    { label: 'Lavande', value: '#E6E6FA' },
    { label: 'Corail', value: '#FF7F7F' },
    { label: 'Cyan', value: '#B0E0E6' },
    { label: 'Lime', value: '#D4FF00' },
];

export default function HighlightModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const dataRef = useRef<HighlightModalData | null>(null);
    const [color, setColor] = useState(PRESET_COLORS[0].value);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handler = (e: CustomEventInit<HighlightModalData>) => {
            if (!e.detail) return;
            dataRef.current = e.detail;
            setColor(PRESET_COLORS[0].value);
            setComment('');
            setVisible(true);
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openHighlightModal, handler);
        return () =>
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.openHighlightModal, handler);
    }, []);

    const handleSave = useCallback(async () => {
        const data = dataRef.current;
        if (!data) return;
        setSaving(true);
        try {
            await window.api.highlights.create({
                documentTitle: data.documentTitle,
                sermonId: data.sermonId,
                paragraphs: data.paragraphs,
                textSnippet: data.textSnippet,
                color,
                comment: comment || undefined,
                documentType: data.documentType,
                translationId: data.translationId,
                languageCode: data.languageCode,
            });
            window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            message.success('Surlignage enregistré');
            hide();
        } catch {
            message.error("Erreur lors de l'enregistrement");
        } finally {
            setSaving(false);
        }
    }, [color, comment, hide]);

    return (
        <Modal
            title="Souligner"
            open={visible}
            onCancel={hide}
            footer={[
                <Button key="cancel" onClick={hide}>
                    Annuler
                </Button>,
                <Button key="save" type="primary" loading={saving} onClick={handleSave}>
                    Enregistrer
                </Button>,
            ]}
            width={420}
        >
            <div style={{ marginBottom: 16 }}>
                <div
                    style={{
                        padding: '8px 12px',
                        background: '#f5f5f5',
                        borderRadius: 6,
                        fontSize: '0.9em',
                        maxHeight: 80,
                        overflow: 'auto',
                    }}
                >
                    {dataRef.current?.textSnippet}
                </div>
            </div>
            <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Couleur</div>
                <Space size="small" wrap>
                    {PRESET_COLORS.map((c) => (
                        <div
                            key={c.value}
                            title={c.label}
                            onClick={() => setColor(c.value)}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                backgroundColor: c.value,
                                cursor: 'pointer',
                                border: '2px solid #d9d9d9',
                                boxShadow: color === c.value ? '0 0 0 2px #1677ff' : 'none',
                                transition: 'box-shadow 0.2s',
                            }}
                        />
                    ))}
                </Space>
            </div>
            <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Commentaire</div>
                <Input.TextArea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ajouter un commentaire (optionnel)"
                />
            </div>
        </Modal>
    );
}
