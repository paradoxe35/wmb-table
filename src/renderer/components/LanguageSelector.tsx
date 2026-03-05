import { useEffect, useState } from 'react';
import { Button, Select } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useAppStore, useSermonStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';
import type { InstalledLanguage, SermonMetaWithTraductions } from '@shared/types';

export default function LanguageSelector() {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
    const setSermons = useSermonStore((s) => s.setSermons);
    const [languages, setLanguages] = useState<InstalledLanguage[]>([]);

    useEffect(() => {
        (window.api.languages.getInstalled() as Promise<InstalledLanguage[]>).then(setLanguages);
    }, []);

    const handleChange = async (code: string) => {
        setActiveLanguage(code);
        await window.api.app.setActiveLanguage(code);
        const sermons = (await window.api.documents.getTitles(code)) as SermonMetaWithTraductions[];
        setSermons(sermons);
    };

    const handleManageLanguages = () => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLanguageManager));
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            {languages.length > 1 && (
                <Select
                    value={activeLanguage}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    size="small"
                >
                    {languages.map((lang) => (
                        <Select.Option key={lang.code} value={lang.code}>
                            {lang.language} ({lang.sermonsCount})
                        </Select.Option>
                    ))}
                </Select>
            )}
            <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={handleManageLanguages}
                title="Gérer les langues"
            />
        </div>
    );
}
