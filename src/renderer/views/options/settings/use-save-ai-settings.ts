import { useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAiChatStore } from '@renderer/stores';
import type { AiSettingsUpdate } from '@renderer/stores/ai-settings-save-queue';

const SAVE_ERROR_MESSAGE_KEY = 'ai-settings-save-error';

/** Saves AI settings and tells the user when a save fails. */
export function useSaveAiSettings(): (update: AiSettingsUpdate) => void {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const saveSettings = useAiChatStore((s) => s.saveSettings);

    return useCallback(
        (update: AiSettingsUpdate) => {
            saveSettings(update).catch(() => {
                void message.error({
                    key: SAVE_ERROR_MESSAGE_KEY,
                    content: t("Les paramètres de l'assistant n'ont pas pu être enregistrés."),
                });
            });
        },
        [saveSettings, message, t],
    );
}
