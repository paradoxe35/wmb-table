import { Button, Tooltip } from 'antd';
import { ReadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';

export function ReadingModeToggle() {
    const { t } = useTranslation();
    const readingMode = useAppStore((s) => s.readingMode);
    const toggleReadingMode = useAppStore((s) => s.toggleReadingMode);

    const label = readingMode ? t('Quitter le mode lecture') : t('Mode lecture');

    return (
        <Tooltip title={label}>
            <Button
                type="text"
                size="small"
                icon={<ReadOutlined />}
                onClick={toggleReadingMode}
                aria-label={label}
                style={
                    readingMode
                        ? {
                              color: 'var(--ant-color-primary)',
                              backgroundColor: 'var(--ant-color-primary-bg)',
                          }
                        : undefined
                }
            />
        </Tooltip>
    );
}
