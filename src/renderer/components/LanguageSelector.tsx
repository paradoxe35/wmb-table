import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { useAppStore, useSermonStore } from '@renderer/stores';
import type { InstalledLanguage, SermonMeta } from '@shared/types';

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
        const sermons = (await window.api.documents.getTitles(code)) as SermonMeta[];
        setSermons(sermons);
    };

    if (languages.length <= 1) return null;

    return (
        <Select
            value={activeLanguage}
            onChange={handleChange}
            style={{ width: '100%', marginBottom: 8 }}
            size="small"
        >
            {languages.map((lang) => (
                <Select.Option key={lang.code} value={lang.code}>
                    {lang.language} ({lang.sermonsCount})
                </Select.Option>
            ))}
        </Select>
    );
}
