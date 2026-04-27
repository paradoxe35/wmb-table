import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { Button, Input, Popover, Space, Tooltip } from 'antd';
import { DisconnectOutlined, ExportOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

function normalizeLinkHref(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

type LinkPopoverButtonProps = {
    editor: Editor;
    active: boolean;
    buttonStyle?: CSSProperties;
};

export function LinkPopoverButton({ editor, active, buttonStyle }: LinkPopoverButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [href, setHref] = useState('');

    const onOpenChange = useCallback(
        (nextOpen: boolean) => {
            setOpen(nextOpen);
            if (nextOpen) {
                setHref((editor.getAttributes('link').href as string | undefined) ?? '');
            }
        },
        [editor],
    );

    const onSave = useCallback(() => {
        const normalizedHref = normalizeLinkHref(href);
        const chain = editor.chain().focus().extendMarkRange('link');

        if (normalizedHref) {
            chain.setLink({ href: normalizedHref, target: '_blank' }).run();
        } else {
            chain.unsetLink().run();
        }

        setOpen(false);
    }, [editor, href]);

    const onRemove = useCallback(() => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setHref('');
        setOpen(false);
    }, [editor]);

    const onOpenLink = useCallback(() => {
        const normalizedHref =
            normalizeLinkHref(href) ||
            ((editor.getAttributes('link').href as string | undefined) ?? '');
        if (!normalizedHref) return;

        window.open(normalizedHref, '_blank', 'noopener,noreferrer');
    }, [editor, href]);

    return (
        <Popover
            trigger="click"
            placement="bottom"
            open={open}
            onOpenChange={onOpenChange}
            content={
                <form
                    className="tiptap-link-popover"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSave();
                    }}
                >
                    <Input
                        autoFocus
                        size="small"
                        value={href}
                        onChange={(event) => setHref(event.currentTarget.value)}
                        placeholder={t('Adresse du lien')}
                    />
                    <Space size={6}>
                        <Button type="primary" size="small" htmlType="submit">
                            {t('Enregistrer')}
                        </Button>
                        {active ? (
                            <>
                                <Tooltip title={t('Ouvrir')}>
                                    <Button
                                        size="small"
                                        icon={<ExportOutlined />}
                                        onClick={onOpenLink}
                                        aria-label={t('Ouvrir')}
                                    />
                                </Tooltip>
                                <Tooltip title={t('Supprimer le lien')}>
                                    <Button
                                        danger
                                        size="small"
                                        icon={<DisconnectOutlined />}
                                        onClick={onRemove}
                                        aria-label={t('Supprimer le lien')}
                                    />
                                </Tooltip>
                            </>
                        ) : null}
                    </Space>
                </form>
            }
        >
            <span>
                <Tooltip title={active ? t('Modifier le lien') : t('Ajouter un lien')}>
                    <Button
                        type={active ? 'primary' : 'text'}
                        size="small"
                        style={buttonStyle}
                        icon={<LinkOutlined />}
                    />
                </Tooltip>
            </span>
        </Popover>
    );
}
