import { Button, Input, Modal, Space, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckOutlined } from '@ant-design/icons';
import { useModalVisible } from '@renderer/hooks';
import {
    CHILD_PARENT_WINDOW_EVENT,
    HIGHLIGHT_EVENT,
    type OpenHighlightModalDetail,
} from '@renderer/utils/events';

type HighlightPresetColor = {
    label: string;
    value: string;
};

const PRESET_COLORS: HighlightPresetColor[] = [
    { label: 'Jaune', value: '#FFF59D' },
    { label: 'Vert', value: '#C5E1A5' },
    { label: 'Bleu', value: '#90CAF9' },
    { label: 'Rose', value: '#F8BBD0' },
    { label: 'Orange', value: '#FFCC80' },
    { label: 'Violet', value: '#D1C4E9' },
    { label: 'Turquoise', value: '#80DEEA' },
    { label: 'Rouge', value: '#EF9A9A' },
];

const DEFAULT_HIGHLIGHT_COLOR = PRESET_COLORS[0].value;

function HighlightSnippetPreview({ text }: { text?: string }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div
                style={{
                    padding: '8px 12px',
                    background: 'var(--ant-color-fill-quaternary)',
                    borderRadius: 6,
                    fontSize: 'var(--fs-rel-3xl)',
                    maxHeight: 80,
                    overflow: 'auto',
                }}
            >
                {text}
            </div>
        </div>
    );
}

function HighlightColorSwatch({
    color,
    selected,
    title,
    onSelect,
}: {
    color: string;
    selected: boolean;
    title: string;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onSelect}
            aria-pressed={selected}
            style={{
                appearance: 'none',
                position: 'relative',
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: '50%',
                backgroundColor: color,
                cursor: 'pointer',
                outline: 'none',
                border: '3px solid transparent',
                borderColor: selected ? 'var(--ant-color-primary)' : 'transparent',
                boxShadow: selected
                    ? '0 0 0 2px color-mix(in srgb, var(--ant-color-primary) 20%, transparent)'
                    : 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
                transition: 'box-shadow 0.2s, border-color 0.2s',
            }}
        >
            {selected && (
                <CheckOutlined
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'rgba(0, 0, 0, 0.65)',
                        fontSize: 14,
                    }}
                />
            )}
        </button>
    );
}

function HighlightColorPicker({
    colors,
    selectedColor,
    onSelectColor,
    label,
    translate,
}: {
    colors: HighlightPresetColor[];
    selectedColor: string;
    onSelectColor: (color: string) => void;
    label: string;
    translate: (value: string) => string;
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{label}</div>
            <Space size="small" wrap>
                {colors.map((preset) => (
                    <HighlightColorSwatch
                        key={preset.value}
                        color={preset.value}
                        selected={selectedColor === preset.value}
                        title={translate(preset.label)}
                        onSelect={() => onSelectColor(preset.value)}
                    />
                ))}
            </Space>
        </div>
    );
}

export default function HighlightModal() {
    const { t } = useTranslation();
    const { visible, hide, setVisible } = useModalVisible();
    const dataRef = useRef<OpenHighlightModalDetail | null>(null);
    const [color, setColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handler = (e: CustomEventInit<OpenHighlightModalDetail>) => {
            if (!e.detail) return;
            dataRef.current = e.detail;
            setColor(DEFAULT_HIGHLIGHT_COLOR);
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
                documentIdentity: data.documentIdentity,
                paragraphs: data.paragraphs,
                textSnippet: data.textSnippet,
                color,
                comment: comment || undefined,
                languageCode: data.languageCode,
            });
            window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            message.success(t('Surlignage enregistré'));
            hide();
        } catch {
            message.error(t("Erreur lors de l'enregistrement"));
        } finally {
            setSaving(false);
        }
    }, [color, comment, hide]);

    return (
        <Modal
            title={t('Souligner')}
            open={visible}
            onCancel={hide}
            footer={[
                <Button key="cancel" onClick={hide}>
                    {t('Annuler')}
                </Button>,
                <Button key="save" type="primary" loading={saving} onClick={handleSave}>
                    {t('Enregistrer')}
                </Button>,
            ]}
            width={420}
        >
            <HighlightSnippetPreview text={dataRef.current?.textSnippet} />
            <HighlightColorPicker
                colors={PRESET_COLORS}
                selectedColor={color}
                onSelectColor={setColor}
                label={t('Couleur')}
                translate={t}
            />
            <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('Commentaire')}</div>
                <Input.TextArea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('Ajouter un commentaire (optionnel)')}
                />
            </div>
        </Modal>
    );
}
