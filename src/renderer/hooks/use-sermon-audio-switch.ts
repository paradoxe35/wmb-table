import { useCallback, useMemo } from 'react';
import { useAudioStore } from '@renderer/stores';
import { useSermonTranslations } from './use-sermon-translations';
import { requestAudioDocumentPlay } from '@renderer/utils/events';
import { toAudioPlayRequest } from '@renderer/utils/sermon-utils';
import type { SermonMeta } from '@shared/types';

export interface SermonAudioSwitch {
    /** Translations of the playing sermon that have their own recording. */
    translations: SermonMeta[];
    activeTranslationId: number | null;
    /** Loads another translation's recording, paused at its own saved position. */
    selectTranslation(translationId: number): void;
}

/** Selecting a translation stops the current recording and loads the new one paused. */
export function useSermonAudioSwitch(): SermonAudioSwitch {
    const sermonId = useAudioStore((s) => s.sermonId);
    const languageCode = useAudioStore((s) => s.languageCode);
    const activeTranslationId = useAudioStore((s) => s.translationId);

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

    return { translations, activeTranslationId, selectTranslation };
}
