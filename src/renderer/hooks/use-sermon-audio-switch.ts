import { useCallback, useMemo } from 'react';
import { useAudioStore, useDocumentTabsStore } from '@renderer/stores';
import { usePrepareTabIdentityChange } from '@renderer/hooks';
import { useSermonTranslations } from './use-sermon-translations';
import { requestAudioDocumentPlay } from '@renderer/utils/events';
import { toAudioPlayRequest } from '@renderer/utils/sermon-utils';
import { getTabKey, type SermonMeta, type SermonTab } from '@shared/types';

export interface SermonAudioSwitch {
    /** Translations of the playing sermon that have their own recording. */
    translations: SermonMeta[];
    activeTranslationId: number | null;
    /** Loads another translation's recording, paused at its own saved position. */
    selectTranslation(translationId: number): void;
    /** Aligns the open tab with whatever is currently loaded in the player. */
    syncTabToPlayingTranslation(): void;
}

/**
 * Lets the player move between the translations of the sermon it is playing.
 * Selecting one stops the current recording and loads the new one paused; the
 * reading tab follows the player only once playback actually starts.
 */
export function useSermonAudioSwitch(): SermonAudioSwitch {
    const sermonId = useAudioStore((s) => s.sermonId);
    const languageCode = useAudioStore((s) => s.languageCode);
    const activeTranslationId = useAudioStore((s) => s.translationId);
    const updateSermonTab = useDocumentTabsStore((s) => s.updateSermonTab);
    const prepareTabIdentityChange = usePrepareTabIdentityChange();

    const sermonTranslations = useSermonTranslations(sermonId, languageCode);
    const translations = useMemo(
        () => sermonTranslations.filter((translation) => translation.audioLink),
        [sermonTranslations],
    );

    const selectTranslation = useCallback(
        (translationId: number) => {
            if (translationId === activeTranslationId) return;

            const target = translations.find(
                (translation) => translation.translationId === translationId,
            );
            const request = target && toAudioPlayRequest(target, false);
            if (!request) return;

            requestAudioDocumentPlay(request);
        },
        [activeTranslationId, translations],
    );

    const syncTabToPlayingTranslation = useCallback(() => {
        const playing = translations.find(
            (translation) => translation.translationId === activeTranslationId,
        );
        if (!playing) return;

        const openTabs = useDocumentTabsStore
            .getState()
            .tabs.filter(
                (tab): tab is SermonTab =>
                    tab.type === 'sermon' &&
                    tab.documentId === playing.sermonId &&
                    tab.languageCode === playing.languageCode,
            );

        const alreadyOpen = openTabs.some((tab) => tab.translationId === playing.translationId);
        if (openTabs.length === 0 || alreadyOpen) {
            return;
        }

        const target = openTabs.find((tab) => tab.active) ?? openTabs[0];
        const tabKey = getTabKey(target);

        prepareTabIdentityChange(tabKey, { stopTts: true, ttsStopMode: 'remember' });
        updateSermonTab(tabKey, {
            title: playing.title,
            documentId: playing.sermonId,
            translationId: playing.translationId,
            languageCode: playing.languageCode,
        });
    }, [activeTranslationId, prepareTabIdentityChange, translations, updateSermonTab]);

    return { translations, activeTranslationId, selectTranslation, syncTabToPlayingTranslation };
}
