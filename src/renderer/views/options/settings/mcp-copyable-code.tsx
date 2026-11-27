import { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const COPIED_FEEDBACK_MS = 1500;

const CODE_BLOCK_STYLE = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    padding: '6px 8px',
    borderRadius: 6,
    background: 'var(--ant-color-fill-tertiary)',
} as const;

const CODE_STYLE = {
    flex: 1,
    minWidth: 0,
    margin: 0,
    fontFamily: 'var(--ant-font-family-code, monospace)',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 'var(--fs-rel-lg)',
} as const;

export function CopyableCode({ code, label }: { code: string; label: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    async function copy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
    }

    return (
        <div className="mcp-server__code" style={CODE_BLOCK_STYLE}>
            <pre style={CODE_STYLE}>{code}</pre>
            <Tooltip title={copied ? t('Copié') : t('Copier')}>
                <Button
                    type="text"
                    size="small"
                    aria-label={t('Copier {{label}}', { label })}
                    icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={() => void copy()}
                />
            </Tooltip>
        </div>
    );
}
